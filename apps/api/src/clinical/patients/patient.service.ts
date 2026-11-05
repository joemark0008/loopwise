import { normalizePhone, PATIENT_LANGUAGES } from '@loopwise/shared/patient-registration';
import { Injectable } from '@nestjs/common';

import { ChatRepository } from '../../chats/chat.repository.js';
import { EntityNotFoundError } from '../../common/errors/domain-error.js';
import { AuditService } from '../audit/audit.service.js';
import { auditChanges } from '../audit/audit-changes.js';
import { ReferenceService } from '../reference/reference.service.js';
import { ClinicalDbService } from '../rls/clinical-db.service.js';
import { assertCardPatient, WiseProposalService } from '../wise-proposals/wise-proposal.service.js';
import { CareClinicService } from './care-clinic.service.js';
import type { SearchPatientsInput, UpdatePatientInput } from './dto/patient.input.js';
import type { ClinicRef } from './models/clinic-ref.model.js';
import { type Patient, toPatient } from './models/patient.model.js';
import { dateOnly } from './parse-input.js';
import { PatientRepository } from './patient.repository.js';
import { PatientChartRepository } from './patient-chart.repository.js';
import { renderChartSummary } from './patient-chart-summary.js';
import { InvalidInputError, NothingToChangeError } from './patients.errors.js';

const SEARCH_LIMIT = 25;

/**
 * Patient lookup and contact details (DESIGN.md §5, §8). Reads run as the user, so row-level security decides what
 * they see, and every patient shown is audited as a view (RA 10173). Registration is in `PatientRegistrationService`.
 */
@Injectable()
export class PatientService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly patients: PatientRepository,
		private readonly charts: PatientChartRepository,
		private readonly clinics: CareClinicService,
		private readonly reference: ReferenceService,
		private readonly audit: AuditService,
		private readonly chats: ChatRepository,
		private readonly wiseProposals: WiseProposalService,
	) {}

	/** The clinics where the user registers patients and records visits. */
	myCareClinics(userId: string): Promise<ClinicRef[]> {
		return this.clinics.list(userId);
	}

	/** Patients the user may see, by name words, patient no. / ID number or birth date. Not audited: a list. */
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
			await this.audit.recordMany(
				tx,
				patients.map((patient) => ({
					action: 'VIEW' as const,
					event: 'patient.view',
					entityType: 'Patient',
					entityId: patient.id,
					userId,
					patientId: patient.id,
					organizationId: patient.organizationId,
					reason: 'Wise find_patient',
				})),
			);
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
			await this.audit.view(tx, {
				event: 'patient.view',
				entityType: 'Patient',
				entityId: id,
				userId,
				patientId: id,
				organizationId: row.organizationId,
				reason: reason ?? null,
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
	 * Changes a patient's contact details (mobile, preferred language, barangay / address line), as the user: row-level
	 * security decides who may see the patient, and only staff at a clinic of the patient's organization change them.
	 * Names, birth date, sex and IDs are not changed here; they drive the duplicate match. With `wiseOrigin` (a
	 * `propose_patient_update` card) the card is verified and settled in the same transaction.
	 */
	async updateContact(userId: string, input: UpdatePatientInput): Promise<Patient> {
		const changes = parseContactChanges(input);
		return this.db.asUser(userId, async (tx) => {
			const before = await this.patients.getById(tx, input.patientId);
			if (!before) {
				throw new EntityNotFoundError('Patient', input.patientId);
			}
			const clinic = await this.clinics.requireInOrganization(userId, before.organizationId);
			const card = await this.wiseProposals.verifyAction(
				userId,
				input.wiseOrigin,
				'updatePatient',
				before.organizationId,
			);
			assertCardPatient(card, input.patientId);
			if (changes.patient) {
				await this.patients.updateContact(tx, input.patientId, changes.patient);
			}
			if (changes.barangay !== undefined || changes.addressLine !== undefined) {
				const barangay = changes.barangay
					? await this.reference.resolveBarangay(tx, changes.barangay, clinic.cityMunicipalityCode)
					: null;
				await this.patients.upsertPrimaryAddress(tx, input.patientId, {
					...(changes.barangay !== undefined && {
						barangayCode: barangay?.code ?? null,
						cityMunicipalityCode: barangay?.cityMunicipalityCode ?? null,
					}),
					...(changes.addressLine !== undefined && { addressLine: changes.addressLine }),
				});
			}
			await this.wiseProposals.settleAction(tx, userId, card, {
				entityType: 'Patient',
				entityId: input.patientId,
			});
			const after = (await this.patients.getById(tx, input.patientId))!;
			const patient = toPatient(after);
			await this.audit.updated(tx, {
				event: 'patient.update',
				entityType: 'Patient',
				entityId: input.patientId,
				userId,
				patientId: input.patientId,
				organizationId: before.organizationId,
				clinicId: clinic.id,
				changes: auditChanges(contactOf(toPatient(before)), contactOf(patient)),
				origin: card?.origin,
			});
			return patient;
		});
	}

	/**
	 * What Wise is told about the patient of a chart chat, read as the user on every run (so it is current and
	 * row-level security applies), as Markdown lines; audited as a view. Null when the user may no longer see them.
	 */
	getChartSummary(userId: string, patientId: string, today = new Date()): Promise<string | null> {
		return this.db.asUser(userId, async (tx) => {
			const patient = await this.charts.getChart(tx, patientId);
			if (!patient) {
				return null;
			}
			// One after the other: a transaction's queries share one connection.
			const diagnoses = await this.charts.listDiagnoses(tx, patientId);
			const vitals = await this.charts.latestVitals(tx, patientId);
			const medicines = await this.charts.listIssuedMedicines(tx, patientId);
			const results = await this.charts.listLatestResults(tx, patientId);
			await this.audit.view(tx, {
				event: 'patient.view',
				entityType: 'Patient',
				entityId: patientId,
				userId,
				patientId,
				organizationId: patient.organizationId,
				reason: 'Wise chart chat',
			});
			return renderChartSummary({ patient, diagnoses, vitals, medicines, results }, today);
		});
	}
}

function searchOptions(input: SearchPatientsInput, take: number) {
	const query = input.query?.trim() ?? '';
	const words = query.split(/\s+/).filter(Boolean);
	let birthDate: Date | undefined;
	if (input.birthDate) {
		birthDate = dateOnly(input.birthDate);
		if (Number.isNaN(birthDate.getTime())) {
			throw new InvalidInputError('Use the format YYYY-MM-DD for the birth date.');
		}
	}
	return { words, identifier: words.length === 1 ? words[0] : undefined, birthDate, take };
}

interface ContactChanges {
	patient?: { mobileNo?: string | null; preferredLanguage?: string };
	barangay?: string | null;
	addressLine?: string | null;
}

/** The contact fields the input sets, normalized like registration does; NOTHING_TO_CHANGE when none. */
function parseContactChanges(input: UpdatePatientInput): ContactChanges {
	const patient: NonNullable<ContactChanges['patient']> = {};
	if (input.phone !== undefined) {
		const phone = input.phone?.trim();
		if (phone && !normalizePhone(phone)) {
			throw new InvalidInputError('Use a Philippine mobile number, e.g. 0917 123 4567.');
		}
		patient.mobileNo = phone ? normalizePhone(phone) : null;
	}
	if (input.preferredLanguage !== undefined && input.preferredLanguage !== null) {
		const wanted = input.preferredLanguage.trim().toLowerCase();
		const language = PATIENT_LANGUAGES.find(
			(candidate) => candidate.value === wanted || candidate.label.toLowerCase().startsWith(wanted),
		);
		if (!wanted || !language) {
			throw new InvalidInputError(
				`Use one of: ${PATIENT_LANGUAGES.map((candidate) => candidate.label).join(', ')}.`,
			);
		}
		patient.preferredLanguage = language.value;
	}
	const changes: ContactChanges = Object.keys(patient).length > 0 ? { patient } : {};
	if (input.barangay !== undefined) {
		changes.barangay = input.barangay?.trim() || null;
	}
	if (input.addressLine !== undefined) {
		changes.addressLine = input.addressLine?.trim() || null;
	}
	if (Object.keys(changes).length === 0) {
		throw new NothingToChangeError();
	}
	return changes;
}

const contactOf = (patient: Patient) => ({
	phone: patient.phone,
	preferredLanguage: patient.preferredLanguage,
	barangay: patient.barangay,
	addressLine: patient.address?.addressLine ?? null,
});
