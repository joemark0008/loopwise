import { Injectable } from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import { CareClinicService } from '../patients/care-clinic.service.js';
import { PatientAllergyService } from '../patients/patient-allergy.service.js';
import { ClinicalDbService } from '../rls/clinical-db.service.js';
import { EncounterRepository } from './encounter.repository.js';
import { EncounterRecordRepository } from './encounter-record.repository.js';
import { toEncounter } from './models/encounter.model.js';
import {
	type EncounterRecord,
	type PatientOverview,
	toDiagnosis,
	toVitalSigns,
} from './models/encounter-record.model.js';

/** How many visits the chart overview reads. */
const OVERVIEW_VISITS = 20;

/**
 * The record of an encounter in one read (DESIGN.md §5): the visit and its note, vitals, diagnoses and the patient's
 * allergies; the documents, orders and invoices are added by their own modules (fields of `EncounterRecord` /
 * `PatientVisit`). Read as the user under row-level security, and audited as a view (RA 10173).
 */
@Injectable()
export class EncounterRecordService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly encounters: EncounterRepository,
		private readonly records: EncounterRecordRepository,
		private readonly allergies: PatientAllergyService,
		private readonly clinics: CareClinicService,
		private readonly audit: AuditService,
	) {}

	/** The encounter's record; null when the user may not see it. */
	async get(userId: string, encounterId: string): Promise<EncounterRecord | null> {
		return this.db.asUser(userId, async (tx) => {
			const row = await this.encounters.findById(tx, encounterId);
			if (!row) {
				return null;
			}
			// One after the other: a transaction's queries share one connection.
			const vitals = await this.records.listVitals(tx, row.id);
			const diagnoses = await this.records.listDiagnoses(tx, row.id);
			const allergies = await this.allergies.listActiveOn(tx, row.patientId);
			await this.audit.view(tx, {
				event: 'encounter.view',
				entityType: 'Encounter',
				entityId: row.id,
				userId,
				patientId: row.patientId,
				organizationId: row.clinic.organizationId,
				clinicId: row.clinicId,
			});
			return {
				encounter: toEncounter(row),
				vitals: vitals.map(toVitalSigns),
				diagnoses: diagnoses.map(toDiagnosis),
				allergies,
				canEdit: row.status !== 'CANCELLED' && (await this.clinics.worksAt(userId, row.clinicId)),
			};
		});
	}

	/**
	 * The chart's overview: the latest visits with their diagnoses. Read as the user, so it is empty for a patient not
	 * in your care; audited as one view of the patient's record.
	 */
	async getPatientOverview(userId: string, patientId: string): Promise<PatientOverview> {
		return this.db.asUser(userId, async (tx) => {
			const rows = await this.records.listVisits(tx, patientId, OVERVIEW_VISITS);
			if (rows.length > 0) {
				await this.audit.view(tx, {
					event: 'patient.overview',
					entityType: 'Patient',
					entityId: patientId,
					userId,
					patientId,
				});
			}
			return {
				patientId,
				visits: rows.map((row) => ({
					encounter: toEncounter(row),
					diagnoses: row.diagnosis.map(toDiagnosis),
				})),
			};
		});
	}
}
