import {
	IDENTIFIER_SYSTEMS,
	type PatientDraft,
	PatientDraftSchema,
	patientInitials,
} from '@loopwise/shared/patient-registration';
import { Injectable } from '@nestjs/common';

import { ChatRepository } from '../../chats/chat.repository.js';
import { HandlerError } from '../../common/errors/handler-error.js';
import { Prisma } from '../../generated/prisma/client.js';
import { OrganizationRepository } from '../../organizations/organization.repository.js';
import { ClinicalDbService } from '../rls/clinical-db.service.js';
import { assertCardPatient, WiseProposalService } from '../wise-proposals/wise-proposal.service.js';
import type {
	LinkExistingPatientInput,
	PatientDraftInput,
	RegisterPatientInput,
	SearchPatientsInput,
	UpdatePatientInput,
} from './dto/patient.input.js';
import { DuplicateMatch, type Facility, type Patient, type PatientDuplicate } from './models/patient.model.js';
import {
	type PatientChartRow,
	type PatientMatchRow,
	PatientRepository,
	type PatientRow,
} from './patient.repository.js';

const SEARCH_LIMIT = 25;

interface Match {
	row: PatientMatchRow;
	match: DuplicateMatch;
	matchedOn: string;
}

/**
 * Patient registration and lookup (DESIGN.md §5, §8). Registering is system work: it creates the patient, their
 * identifiers at the facility and the registering user's care relationship, and writes its own audit row. Reads run
 * as the user, so row-level security decides what they see.
 *
 * Duplicates (deterministic, §12): the MRN at the facility or the PhilHealth number at any facility is an exact match
 * and is never registered twice; the same name, birth date and sex is a possible match the clinician confirms.
 */
/** The Wise card that confirms into `register` / `linkExisting`. */
const REGISTRATION_CARD = 'propose_patient_registration';

@Injectable()
export class PatientService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly patients: PatientRepository,
		private readonly organizations: OrganizationRepository,
		private readonly chats: ChatRepository,
		private readonly wiseProposals: WiseProposalService,
	) {}

	async myFacilities(userId: string): Promise<Facility[]> {
		const facilities = await this.organizations.getUserFacilities(userId);
		return facilities.map(({ id, name, slug, type }) => ({ id, name, slug, type }));
	}

	async checkDuplicates(userId: string, input: PatientDraftInput): Promise<PatientDuplicate[]> {
		const facility = await this.requireFacility(userId, input.facilityId);
		const draft = parseDraft(input);
		const matches = await this.db.asSystem((tx) => this.findMatches(tx, facility.id, draft));
		return this.present(userId, matches);
	}

	async register(
		userId: string,
		input: RegisterPatientInput,
	): Promise<{ patient: Patient | null; duplicates: PatientDuplicate[] }> {
		const facility = await this.requireFacility(userId, input.facilityId);
		const draft = parseDraft(input);
		requireConsent(input.consentGiven);
		const card = input.wiseOrigin
			? await this.wiseProposals.verify(userId, input.wiseOrigin, { toolNames: [REGISTRATION_CARD] })
			: undefined;

		const outcome: { matches: Match[] } | { patientId: string } = await this.db
			.asSystem(async (tx): Promise<{ matches: Match[] } | { patientId: string }> => {
				const matches = await this.findMatches(tx, facility.id, draft);
				const blocked = matches.some((match) => match.match === DuplicateMatch.EXACT_IDENTIFIER);
				if (blocked || (matches.length > 0 && !input.acknowledgeDuplicates)) {
					return { matches };
				}
				const { id } = await this.patients.create(tx, {
					givenName: draft.givenName,
					familyName: draft.familyName,
					birthDate: toDate(draft.birthDate),
					sex: draft.sex,
					phone: draft.phone ?? null,
					preferredLanguage: draft.preferredLanguage,
					consentAt: new Date(),
				});
				await this.patients.addIdentifiers(tx, id, identifiersOf(draft, facility.id));
				await this.patients.addCareRelationship(tx, {
					patientId: id,
					userId,
					orgId: facility.id,
					reason: 'encounter',
				});
				if (card) {
					await this.wiseProposals.settle(tx, userId, card, { resource: 'patient', resourceId: id });
				}
				await this.patients.writeAudit(tx, {
					userId,
					orgId: facility.id,
					action: 'patient.register',
					patientId: id,
					...(matches.length > 0 && { reason: 'registered despite a name, birth date and sex match' }),
					origin: card?.origin,
				});
				return { patientId: id };
			})
			.catch(async (error: unknown) => {
				// Another registration took the identifier between the check and the insert.
				if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
					return { matches: await this.db.asSystem((tx) => this.findMatches(tx, facility.id, draft)) };
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
	 * Uses an existing patient instead of registering a new one: this facility's identifiers are added to them and
	 * the user gets a care relationship. Only a patient the draft matches can be linked, so knowing an id is never
	 * enough to reach a patient.
	 */
	async linkExisting(userId: string, input: LinkExistingPatientInput): Promise<Patient> {
		const facility = await this.requireFacility(userId, input.facilityId);
		const draft = parseDraft(input);
		requireConsent(input.consentGiven);
		const card = input.wiseOrigin
			? await this.wiseProposals.verify(userId, input.wiseOrigin, { toolNames: [REGISTRATION_CARD] })
			: undefined;
		assertCardPatient(card, input.patientId);

		await this.db.asSystem(async (tx) => {
			const matches = await this.findMatches(tx, facility.id, draft);
			const match = matches.find((candidate) => candidate.row.id === input.patientId);
			if (!match) {
				throw new HandlerError('FORBIDDEN', 'This patient does not match the registration details.');
			}
			// The draft's identifiers may belong to the patient elsewhere; only add those free at this facility.
			const free = [];
			for (const identifier of identifiersOf(draft, facility.id)) {
				const holders = await this.patients.findByIdentifier(tx, {
					system: identifier.system,
					value: identifier.value,
					orgId: facility.id,
				});
				if (holders.length === 0) {
					free.push(identifier);
				}
			}
			await this.patients.addIdentifiers(tx, input.patientId, free);
			await this.patients.setConsentIfMissing(tx, input.patientId, new Date());
			await this.patients.addCareRelationship(tx, {
				patientId: input.patientId,
				userId,
				orgId: facility.id,
				reason: 'encounter',
			});
			if (card) {
				await this.wiseProposals.settle(tx, userId, card, { resource: 'patient', resourceId: input.patientId });
			}
			await this.patients.writeAudit(tx, {
				userId,
				orgId: facility.id,
				action: 'patient.link',
				patientId: input.patientId,
				reason: `duplicate match: ${match.matchedOn}`,
				origin: card?.origin,
			});
		});

		const patient = await this.db.asUser(userId, (tx) => this.patients.getById(tx, input.patientId));
		if (!patient) {
			throw new HandlerError('NOT_FOUND', 'Patient not found.');
		}
		return toPatient(patient);
	}

	/**
	 * Changes a patient's contact details (phone, preferred language, barangay), as the user: row-level security
	 * decides who may see the patient, and only clinic or hospital staff change them. Names, birth date, sex and
	 * identifiers are not changed here; they drive the duplicate match.
	 * With `wiseOrigin` (a `propose_patient_update` card) the card is verified and settled in the same transaction.
	 */
	async updateContact(userId: string, input: UpdatePatientInput): Promise<Patient> {
		const data: { phone?: string | null; preferredLanguage?: string; barangay?: string | null } = {};
		if (input.phone !== undefined) {
			data.phone = input.phone?.trim() || null;
		}
		if (input.preferredLanguage !== undefined && input.preferredLanguage !== null) {
			const language = input.preferredLanguage.trim();
			if (!language) {
				throw new HandlerError('BAD_REQUEST', 'Name the preferred language.');
			}
			data.preferredLanguage = language;
		}
		if (input.barangay !== undefined) {
			data.barangay = input.barangay?.trim() || null;
		}
		if (Object.keys(data).length === 0) {
			throw new HandlerError('BAD_REQUEST', 'Nothing to change.');
		}
		// Seeing a patient isn't enough (a lab sees those it ran tests for): contact details are kept by care facilities.
		const careFacility = (await this.organizations.getUserFacilities(userId)).find(
			(facility) => facility.type === 'clinic' || facility.type === 'hospital',
		);
		if (!careFacility) {
			throw new HandlerError('FORBIDDEN', "Only staff at a clinic or hospital can change a patient's details.");
		}
		const registeredAt = careFacility.id;
		return this.db.asUser(userId, async (tx) => {
			if (!(await this.patients.getById(tx, input.patientId))) {
				throw new HandlerError('NOT_FOUND', 'Patient not found.');
			}
			const card = await this.wiseProposals.verifyAction(userId, input.wiseOrigin, 'updatePatient', registeredAt);
			assertCardPatient(card, input.patientId);
			await this.patients.updateContact(tx, input.patientId, data);
			await this.wiseProposals.settleAction(tx, userId, card, {
				resource: 'patient',
				resourceId: input.patientId,
			});
			await this.patients.writeAudit(tx, {
				userId,
				orgId: registeredAt,
				action: 'patient.update',
				patientId: input.patientId,
				reason: `Changed ${Object.keys(data).join(', ')}`,
				origin: card?.origin,
			});
			return toPatient((await this.patients.getById(tx, input.patientId))!);
		});
	}

	search(userId: string, input: SearchPatientsInput): Promise<Patient[]> {
		const opts = searchOptions(input, SEARCH_LIMIT);
		return this.db.asUser(userId, async (tx) => (await this.patients.search(tx, opts)).map(toPatient));
	}

	/**
	 * Wise's `find_patient`: the same search as the user, and every patient it shows Wise is audited as a view.
	 * `truncated` says more matched than `limit`.
	 */
	findForWise(
		userId: string,
		input: SearchPatientsInput,
		limit: number,
	): Promise<{ patients: Patient[]; truncated: boolean }> {
		const opts = searchOptions(input, limit + 1);
		return this.db.asUser(userId, async (tx) => {
			const rows = await this.patients.search(tx, opts);
			const patients = rows.slice(0, limit).map(toPatient);
			for (const patient of patients) {
				await this.patients.writeAudit(tx, {
					userId,
					action: 'patient.view',
					patientId: patient.id,
					reason: 'Wise find_patient',
				});
			}
			return { patients, truncated: rows.length > limit };
		});
	}

	/** The patient, or null when the user may not see them. Every view is audited. */
	getById(userId: string, id: string, reason?: string): Promise<Patient | null> {
		return this.db.asUser(userId, async (tx) => {
			const row = await this.patients.getById(tx, id);
			if (!row) {
				return null;
			}
			await this.patients.writeAudit(tx, {
				userId,
				action: 'patient.view',
				patientId: id,
				...(reason && { reason }),
			});
			return toPatient(row);
		});
	}

	/** Whether the user may see the patient (row-level security). Not audited: nothing about the patient is shown. */
	isVisible(userId: string, patientId: string): Promise<boolean> {
		return this.db.asUser(userId, async (tx) => (await this.patients.visibleIds(tx, [patientId])).has(patientId));
	}

	/** The user's chart chat about the patient, or null (also when they may not see the patient). */
	async chatIdFor(userId: string, patientId: string): Promise<string | null> {
		if (!(await this.isVisible(userId, patientId))) {
			return null;
		}
		return this.chats.getPatientChatId(userId, patientId);
	}

	/**
	 * What Wise is told about the patient of a chart chat, read as the user on every run (so it is current and
	 * row-level security applies), as Markdown lines. Null when the user may no longer see the patient.
	 */
	getChartSummary(userId: string, patientId: string, today = new Date()): Promise<string | null> {
		return this.db.asUser(userId, async (tx) => {
			const row = await this.patients.getChart(tx, patientId);
			if (!row) {
				return null;
			}
			await this.patients.writeAudit(tx, {
				userId,
				action: 'patient.view',
				patientId,
				reason: 'Wise chart chat',
			});
			return renderChartSummary(row, today);
		});
	}

	private async requireFacility(userId: string, facilityId: string): Promise<Facility> {
		const facility = (await this.myFacilities(userId)).find((candidate) => candidate.id === facilityId);
		if (!facility) {
			throw new HandlerError('FORBIDDEN', 'You can only register patients at a facility you work at.');
		}
		return facility;
	}

	/** Exact identifier matches first, then name + birth date + sex; one entry per patient. */
	private async findMatches(tx: Prisma.TransactionClient, facilityId: string, draft: PatientDraft): Promise<Match[]> {
		const matches = new Map<string, Match>();
		const add = (rows: PatientMatchRow[], match: DuplicateMatch, matchedOn: string) => {
			for (const row of rows) {
				if (!matches.has(row.id)) {
					matches.set(row.id, { row, match, matchedOn });
				}
			}
		};
		if (draft.mrn) {
			const rows = await this.patients.findByIdentifier(tx, {
				system: IDENTIFIER_SYSTEMS.mrn,
				value: draft.mrn,
				orgId: facilityId,
			});
			add(rows, DuplicateMatch.EXACT_IDENTIFIER, `MRN ${draft.mrn}`);
		}
		if (draft.philHealthId) {
			const rows = await this.patients.findByIdentifier(tx, {
				system: IDENTIFIER_SYSTEMS.philHealth,
				value: draft.philHealthId,
			});
			add(rows, DuplicateMatch.EXACT_IDENTIFIER, `PhilHealth ${draft.philHealthId}`);
		}
		const samePerson = await this.patients.findByNameBirthSex(tx, {
			givenName: draft.givenName,
			familyName: draft.familyName,
			birthDate: toDate(draft.birthDate),
			sex: draft.sex,
		});
		add(samePerson, DuplicateMatch.NAME_BIRTH_SEX, 'name, birth date and sex');
		return [...matches.values()];
	}

	/** Masks the matches the user cannot see yet: initials, birth year and facilities only. */
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
				displayName: isVisible
					? `${row.givenName} ${row.familyName}`
					: patientInitials(row.givenName, row.familyName),
				birthYear: row.birthDate.getUTCFullYear(),
				facilityNames: [...new Set(row.identifiers.map((identifier) => identifier.organization.name))],
			};
		});
	}
}

function searchOptions(input: SearchPatientsInput, take: number) {
	const query = input.query?.trim() ?? '';
	const words = query.split(/\s+/).filter(Boolean);
	let birthDate: Date | undefined;
	if (input.birthDate) {
		birthDate = toDate(input.birthDate);
		if (Number.isNaN(birthDate.getTime())) {
			throw new HandlerError('BAD_REQUEST', 'Use the format YYYY-MM-DD for the birth date.');
		}
	}
	return { words, identifier: words.length === 1 ? words[0] : undefined, birthDate, take };
}

function parseDraft(input: PatientDraftInput): PatientDraft {
	const { facilityId: _facilityId, ...fields } = input;
	const parsed = PatientDraftSchema.safeParse({
		...fields,
		phone: fields.phone ?? undefined,
		preferredLanguage: fields.preferredLanguage ?? undefined,
		mrn: fields.mrn ?? undefined,
		philHealthId: fields.philHealthId ?? undefined,
	});
	if (!parsed.success) {
		throw new HandlerError('BAD_REQUEST', parsed.error.issues.map((issue) => issue.message).join(' '));
	}
	return parsed.data;
}

function requireConsent(consentGiven: boolean) {
	if (!consentGiven) {
		throw new HandlerError('BAD_REQUEST', 'Record the patient’s consent before registering them.');
	}
}

function identifiersOf(draft: PatientDraft, orgId: string) {
	return [
		...(draft.mrn ? [{ orgId, system: IDENTIFIER_SYSTEMS.mrn, value: draft.mrn }] : []),
		...(draft.philHealthId ? [{ orgId, system: IDENTIFIER_SYSTEMS.philHealth, value: draft.philHealthId }] : []),
	];
}

function renderChartSummary(row: PatientChartRow, today: Date): string {
	const birthDate = row.birthDate.toISOString().slice(0, 10);
	const lines = [
		`- Name: ${row.givenName} ${row.familyName}`,
		`- Born ${birthDate} (age ${ageOn(row.birthDate, today)}), sex ${row.sex}`,
		`- Preferred language: ${row.preferredLanguage}; mobile: ${row.phone ?? 'none on file'}`,
		`- Consent: ${row.consentAt ? `recorded ${row.consentAt.toISOString().slice(0, 10)}` : 'not recorded'}`,
		...row.identifiers.map(
			(identifier) => `- ${identifier.system} ${identifier.value} (${identifier.organization.name})`,
		),
	];
	lines.push(
		row.allergies.length === 0
			? '- Allergies: none recorded'
			: `- Allergies: ${row.allergies.map((allergy) => (allergy.reaction ? `${allergy.substance} (${allergy.reaction})` : allergy.substance)).join(', ')}`,
	);
	const problems = [...new Map(row.diagnoses.map((diagnosis) => [diagnosis.icd10Code, diagnosis])).values()];
	lines.push(
		problems.length === 0
			? '- Problems: none recorded'
			: `- Problems (ICD-10): ${problems.map((diagnosis) => `${diagnosis.display} (${diagnosis.icd10Code})`).join(', ')}`,
	);
	const medicines = [
		...new Set(
			row.prescriptions.flatMap((prescription) =>
				prescription.items.map((item) =>
					[item.genericName, item.strength, item.frequency].filter(Boolean).join(' '),
				),
			),
		),
	];
	lines.push(`- Prescribed (issued): ${medicines.length === 0 ? 'none' : medicines.join('; ')}`);
	const [vitals] = row.vitalSigns;
	if (vitals) {
		const weight = vitals.weightKg === null ? '' : `, weight ${Number(vitals.weightKg)} kg`;
		const bmi = vitals.bmi === null ? '' : `, BMI ${Number(vitals.bmi)}`;
		lines.push(
			`- Latest vitals (${vitals.recordedAt.toISOString().slice(0, 10)}): BP ${vitals.systolicMmHg}/${vitals.diastolicMmHg ?? '—'} mmHg${weight}${bmi}`,
		);
	}
	if (row.results.length > 0) {
		lines.push('- Latest results (newest first):');
		for (const result of row.results) {
			lines.push(
				`  - ${result.resultedAt.toISOString().slice(0, 10)} [result ${result.id}] ${result.display ?? result.code}: ${result.value}${result.unit ? ` ${result.unit}` : ''}${result.flag && result.flag !== 'normal' ? ` (${result.flag})` : ''}`,
			);
		}
	}
	if (row.encounters.length === 0) {
		lines.push('- Encounters: none yet');
	} else {
		lines.push(`- Latest encounters (newest first, up to ${row.encounters.length}):`);
		for (const encounter of row.encounters) {
			const text = encounter.assessment ?? encounter.notes;
			const notes = text ? ` — ${truncate(text.replace(/\s+/g, ' '), 300)}` : '';
			lines.push(
				`  - ${encounter.startedAt.toISOString().slice(0, 10)} [encounter ${encounter.id}]: ${encounter.reason ?? 'no reason given'}${notes}`,
			);
			// The rest of the SOAP note as it is (the assessment heads the line), so Wise can draft a change to it
			// (`propose_encounter_note`) without asking.
			for (const [label, value] of [
				['History', encounter.history],
				['Exam', encounter.physicalExam],
				['Plan', encounter.plan],
				['Instructions', encounter.patientInstructions],
				['Follow-up on', encounter.followUpOn?.toISOString().slice(0, 10)],
			] as const) {
				if (value) {
					lines.push(`    - ${label}: ${truncate(value.replace(/\s+/g, ' '), 500)}`);
				}
			}
		}
	}
	return lines.join('\n');
}

function ageOn(birthDate: Date, today: Date): number {
	const hadBirthday =
		today.getUTCMonth() > birthDate.getUTCMonth() ||
		(today.getUTCMonth() === birthDate.getUTCMonth() && today.getUTCDate() >= birthDate.getUTCDate());
	return today.getUTCFullYear() - birthDate.getUTCFullYear() - (hadBirthday ? 0 : 1);
}

const truncate = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

const toDate = (value: string) => new Date(`${value}T00:00:00Z`);

function toPatient(row: PatientRow): Patient {
	return {
		id: row.id,
		givenName: row.givenName,
		familyName: row.familyName,
		birthDate: row.birthDate.toISOString().slice(0, 10),
		sex: row.sex,
		phone: row.phone,
		preferredLanguage: row.preferredLanguage,
		barangay: row.barangay,
		consentAt: row.consentAt,
		createdAt: row.createdAt,
		identifiers: row.identifiers.map(({ system, value, orgId }) => ({ system, value, orgId })),
	};
}
