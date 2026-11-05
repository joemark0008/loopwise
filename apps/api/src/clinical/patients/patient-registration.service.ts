import { type PatientDraft, PatientDraftSchema, patientInitials } from '@loopwise/shared/patient-registration';
import { Injectable, Logger } from '@nestjs/common';

import { EntityNotFoundError } from '../../common/errors/domain-error.js';
import { Prisma } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { auditSnapshot } from '../audit/audit-changes.js';
import { DocumentSequenceService } from '../clinics/document-sequences/document-sequence.service.js';
import { ReferenceService } from '../reference/reference.service.js';
import { ClinicalDbService, type ClinicalTx } from '../rls/clinical-db.service.js';
import { assertCardPatient, WiseProposalService } from '../wise-proposals/wise-proposal.service.js';
import { CareClinicService } from './care-clinic.service.js';
import type { LinkExistingPatientInput, PatientDraftInput, RegisterPatientInput } from './dto/patient.input.js';
import type { ClinicRef } from './models/clinic-ref.model.js';
import { type Patient, type PatientDuplicate, patientName, toPatient } from './models/patient.model.js';
import { dateOnly, parseInput } from './parse-input.js';
import { type PatientMatchRow, PatientRepository } from './patient.repository.js';
import { DuplicateMatch } from './patients.enums.js';
import { ConsentRequiredError, InvalidPatientDraftError, PatientDoesNotMatchError } from './patients.errors.js';

/** The Wise card that confirms into `register` / `linkExisting`. */
const REGISTRATION_CARD = 'propose_patient_registration';

interface Match {
	row: PatientMatchRow;
	match: DuplicateMatch;
	matchedOn: string;
}

/**
 * Patient registration (DESIGN.md §5, §8). A patient belongs to the organization of the clinic that registers them,
 * with the clinic's next patient number (DocumentSequence `PATIENT`) unless they bring a chart number. Registering is
 * system work, in one transaction: the patient, their PhilHealth ID and address, the data-privacy consent
 * (RA 10173), the registering user's care relationship and the audit row.
 *
 * Duplicates within the organization (deterministic, §12): the patient number or the PhilHealth number is an exact
 * match and is never registered twice; the same name, birth date and sex is a possible match the clinician confirms.
 */
@Injectable()
export class PatientRegistrationService {
	private readonly logger = new Logger(PatientRegistrationService.name);

	constructor(
		private readonly db: ClinicalDbService,
		private readonly patients: PatientRepository,
		private readonly clinics: CareClinicService,
		private readonly sequences: DocumentSequenceService,
		private readonly reference: ReferenceService,
		private readonly audit: AuditService,
		private readonly wiseProposals: WiseProposalService,
	) {}

	/** The organization's patients the draft would duplicate, masked when the user can't see them. */
	async checkDuplicates(userId: string, input: PatientDraftInput): Promise<PatientDuplicate[]> {
		const clinic = await this.clinics.require(userId, input.clinicId, 'register patients');
		const draft = parseDraft(input);
		const matches = await this.db.asSystem((tx) => this.findMatches(tx, clinic.organizationId, draft));
		return this.present(userId, matches);
	}

	/**
	 * Registers the patient at the clinic, unless an identifier matches (never) or a name, birth date and sex match
	 * was not acknowledged: then `patient` is null and `duplicates` says why. Needs the patient's consent (RA 10173).
	 */
	async register(
		userId: string,
		input: RegisterPatientInput,
	): Promise<{ patient: Patient | null; duplicates: PatientDuplicate[] }> {
		const clinic = await this.clinics.require(userId, input.clinicId, 'register patients');
		const draft = parseDraft(input);
		if (!input.consentGiven) {
			throw new ConsentRequiredError();
		}
		const card = input.wiseOrigin
			? await this.wiseProposals.verify(userId, input.wiseOrigin, {
					toolNames: [REGISTRATION_CARD],
					organizationId: clinic.organizationId,
				})
			: undefined;

		const outcome = await this.db
			.asSystem(async (tx): Promise<{ matches: Match[] } | { patientId: string }> => {
				const matches = await this.findMatches(tx, clinic.organizationId, draft);
				const blocked = matches.some((match) => match.match === DuplicateMatch.EXACT_IDENTIFIER);
				if (blocked || (matches.length > 0 && !input.acknowledgeDuplicates)) {
					return { matches };
				}
				const patient = await this.patients.create(tx, {
					organizationId: clinic.organizationId,
					patientNo: draft.patientNo ?? (await this.sequences.next(tx, clinic, 'PATIENT')),
					firstName: draft.givenName,
					middleName: draft.middleName ?? null,
					lastName: draft.familyName,
					birthDate: dateOnly(draft.birthDate),
					sex: draft.sex,
					mobileNo: draft.phone ?? null,
					preferredLanguage: draft.preferredLanguage,
					philHealthId: draft.philHealthId ?? null,
					address: await this.addressOf(tx, draft, clinic),
					consentWitnessedById: userId,
				});
				await this.patients.addCareRelationship(tx, {
					patientId: patient.id,
					userId,
					organizationId: clinic.organizationId,
					reason: 'ENCOUNTER',
				});
				if (card) {
					await this.wiseProposals.settle(tx, userId, card, { entityType: 'Patient', entityId: patient.id });
				}
				await this.audit.created(tx, {
					event: 'patient.register',
					entityType: 'Patient',
					entityId: patient.id,
					userId,
					patientId: patient.id,
					organizationId: clinic.organizationId,
					clinicId: clinic.id,
					changes: { after: auditSnapshot({ ...toPatient(patient), identifications: undefined }) },
					reason: matches.length > 0 ? 'registered despite a name, birth date and sex match' : null,
					origin: card?.origin,
				});
				return { patientId: patient.id };
			})
			.catch(async (error: unknown) => {
				// Another registration took the patient number between the check and the insert.
				if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
					this.logger.warn(`Registration raced on a unique patient number (clinic ${clinic.id})`);
					return {
						matches: await this.db.asSystem((tx) => this.findMatches(tx, clinic.organizationId, draft)),
					};
				}
				throw error;
			});

		if ('matches' in outcome) {
			return { patient: null, duplicates: await this.present(userId, outcome.matches) };
		}
		const patient = await this.db.asUser(userId, (tx) => this.patients.getById(tx, outcome.patientId));
		return { patient: patient && toPatient(patient), duplicates: [] };
	}

	/**
	 * Uses an existing patient of the organization instead of registering a new one: the user gets a care
	 * relationship, a missing PhilHealth ID and consent are added. Only a patient the draft matches can be linked, so
	 * knowing an id is never enough to reach a patient.
	 */
	async linkExisting(userId: string, input: LinkExistingPatientInput): Promise<Patient> {
		const clinic = await this.clinics.require(userId, input.clinicId, 'register patients');
		const draft = parseDraft(input);
		if (!input.consentGiven) {
			throw new ConsentRequiredError();
		}
		const card = input.wiseOrigin
			? await this.wiseProposals.verify(userId, input.wiseOrigin, {
					toolNames: [REGISTRATION_CARD],
					organizationId: clinic.organizationId,
				})
			: undefined;
		assertCardPatient(card, input.patientId);

		await this.db.asSystem(async (tx) => {
			const matches = await this.findMatches(tx, clinic.organizationId, draft);
			const match = matches.find((candidate) => candidate.row.id === input.patientId);
			if (!match) {
				throw new PatientDoesNotMatchError();
			}
			if (draft.philHealthId) {
				const holders = await this.patients.findByIdentification(
					tx,
					clinic.organizationId,
					'PHILHEALTH_ID',
					draft.philHealthId,
				);
				if (holders.length === 0) {
					await this.patients.addIdentification(tx, input.patientId, {
						type: 'PHILHEALTH_ID',
						idNumber: draft.philHealthId,
					});
				}
			}
			await this.patients.addConsentIfMissing(tx, input.patientId, userId);
			await this.patients.addCareRelationship(tx, {
				patientId: input.patientId,
				userId,
				organizationId: clinic.organizationId,
				reason: 'ENCOUNTER',
			});
			if (card) {
				await this.wiseProposals.settle(tx, userId, card, { entityType: 'Patient', entityId: input.patientId });
			}
			await this.audit.updated(tx, {
				event: 'patient.link',
				entityType: 'Patient',
				entityId: input.patientId,
				userId,
				patientId: input.patientId,
				organizationId: clinic.organizationId,
				clinicId: clinic.id,
				reason: `duplicate match: ${match.matchedOn}`,
				origin: card?.origin,
			});
		});

		const patient = await this.db.asUser(userId, (tx) => this.patients.getById(tx, input.patientId));
		if (!patient) {
			throw new EntityNotFoundError('Patient', input.patientId);
		}
		return toPatient(patient);
	}

	/** The draft's address, its barangay checked against PSGC (the city follows the barangay). */
	private async addressOf(tx: ClinicalTx, draft: PatientDraft, clinic: ClinicRef) {
		if (!draft.barangayCode && !draft.addressLine) {
			return null;
		}
		const barangay = draft.barangayCode
			? await this.reference.resolveBarangay(tx, draft.barangayCode, clinic.cityMunicipalityCode)
			: null;
		return {
			addressLine: draft.addressLine ?? null,
			barangayCode: barangay?.code ?? null,
			cityMunicipalityCode: barangay?.cityMunicipalityCode ?? clinic.cityMunicipalityCode,
		};
	}

	/** Exact identifier matches first, then name + birth date + sex; one entry per patient. */
	private async findMatches(tx: ClinicalTx, organizationId: string, draft: PatientDraft): Promise<Match[]> {
		const matches = new Map<string, Match>();
		const add = (rows: PatientMatchRow[], match: DuplicateMatch, matchedOn: string) => {
			for (const row of rows) {
				if (!matches.has(row.id)) {
					matches.set(row.id, { row, match, matchedOn });
				}
			}
		};
		if (draft.patientNo) {
			const rows = await this.patients.findByPatientNo(tx, organizationId, draft.patientNo);
			add(rows, DuplicateMatch.EXACT_IDENTIFIER, `patient no. ${draft.patientNo}`);
		}
		if (draft.philHealthId) {
			const rows = await this.patients.findByIdentification(
				tx,
				organizationId,
				'PHILHEALTH_ID',
				draft.philHealthId,
			);
			add(rows, DuplicateMatch.EXACT_IDENTIFIER, `PhilHealth ${draft.philHealthId}`);
		}
		const samePerson = await this.patients.findByNameBirthSex(tx, organizationId, {
			firstName: draft.givenName,
			lastName: draft.familyName,
			birthDate: dateOnly(draft.birthDate),
			sex: draft.sex,
		});
		add(samePerson, DuplicateMatch.NAME_BIRTH_SEX, 'name, birth date and sex');
		return [...matches.values()];
	}

	/** Masks the matches the user cannot see yet: initials and birth year only. */
	private async present(userId: string, matches: Match[]): Promise<PatientDuplicate[]> {
		if (matches.length === 0) {
			return [];
		}
		const visible = await this.db.asUser(userId, (tx) =>
			this.patients.visibleIds(
				tx,
				matches.map((match) => match.row.id),
			),
		);
		return matches.map(({ row, match, matchedOn }) => {
			const isVisible = visible.has(row.id);
			return {
				patientId: row.id,
				match,
				visible: isVisible,
				matchedOn,
				displayName: isVisible ? patientName(row) : patientInitials(row.firstName, row.lastName),
				birthYear: row.birthDate.getUTCFullYear(),
			};
		});
	}
}

function parseDraft(input: PatientDraftInput): PatientDraft {
	const { clinicId: _clinicId, ...fields } = input;
	const withoutNulls = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value ?? undefined]));
	return parseInput(PatientDraftSchema, withoutNulls, (message) => new InvalidPatientDraftError(message));
}
