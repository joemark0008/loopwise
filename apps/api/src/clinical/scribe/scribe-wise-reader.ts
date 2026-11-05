import { findLabTest } from '@loopwise/shared/lab-tests';
import { allergyWarnings } from '@loopwise/shared/prescription';
import { proposeScribeNote } from '@loopwise/shared/tools';
import { Injectable } from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import { DiagnosticTestService } from '../diagnostics/catalog/diagnostic-test.service.js';
import type { DiagnosticTest } from '../diagnostics/catalog/models/diagnostic-test.model.js';
import { EncounterService } from '../encounters/encounter.service.js';
import { PatientAllergyService } from '../patients/patient-allergy.service.js';
import { UnknownIcd10CodeError } from '../reference/reference.errors.js';
import { ReferenceService } from '../reference/reference.service.js';
import { ClinicalDbService, type ClinicalTx } from '../rls/clinical-db.service.js';
import { ScribeEncounterNotFoundError } from './scribe.errors.js';

/** What `propose_scribe_note` returns to the scribe panel: the visit, the parts and what was resolved for them. */
export type ScribeDraftForWise = Omit<proposeScribeNote.Output, '_version' | 'success'>;

/**
 * The read behind `propose_scribe_note` (DESIGN.md §7.5), as the user and audited as a view of the visit. It writes
 * nothing: it checks that the visit is the chat's patient's and the user's to add to, checks each drafted ICD-10 code
 * against `icd10_codes`, matches the named tests to the organization's catalog, and lists the patient's allergies and
 * the drafted medicines that match one, so the cards can warn and the model can say so.
 */
@Injectable()
export class ScribeWiseReader {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly encounterAccess: EncounterService,
		private readonly reference: ReferenceService,
		private readonly tests: DiagnosticTestService,
		private readonly allergies: PatientAllergyService,
		private readonly audit: AuditService,
	) {}

	draftForWise(userId: string, patientId: string, input: proposeScribeNote.Input): Promise<ScribeDraftForWise> {
		return this.db.asUser(userId, async (tx) => {
			const found = await this.encounterAccess.findOfPatient(tx, patientId, input.encounterId);
			if (!found || found.id !== input.encounterId) {
				throw new ScribeEncounterNotFoundError(input.encounterId);
			}
			const encounter = await this.encounterAccess.requireWritable(tx, userId, found.id);
			const allergies = await this.allergies.listActiveOn(tx, patientId);
			const diagnoses = await this.checkCodes(tx, input.diagnoses ?? []);
			const catalog = input.orders?.tests.length
				? await this.tests.listActiveOn(tx, encounter.organizationId)
				: [];
			await this.audit.view(tx, {
				event: 'encounter.view',
				entityType: 'Encounter',
				entityId: encounter.id,
				userId,
				patientId,
				organizationId: encounter.organizationId,
				clinicId: encounter.clinicId,
				reason: 'Wise propose_scribe_note',
			});
			return {
				patientId,
				encounter: {
					id: encounter.id,
					encounterNo: encounter.encounterNo,
					startedAt: encounter.startedAt.toISOString(),
					clinicName: encounter.clinicName,
				},
				parts: proposeScribeNote.draftParts(input),
				diagnoses,
				tests: matchTests(input.orders?.tests ?? [], catalog),
				allergies: allergies.map((allergy) => ({ allergen: allergy.allergen, severity: allergy.severity })),
				allergyWarnings: allergyWarnings(input.prescription?.items ?? [], allergies).map(
					({ genericName, allergen }) => ({ genericName, allergen }),
				),
			};
		});
	}

	/** Each code as `icd10_codes` has it; an unknown one is kept, flagged, for the doctor to replace. */
	private async checkCodes(tx: ClinicalTx, diagnoses: readonly proposeScribeNote.Diagnosis[]) {
		const checked: ScribeDraftForWise['diagnoses'] = [];
		for (const diagnosis of diagnoses) {
			try {
				const code = await this.reference.requireIcd10(tx, diagnosis.icd10Code);
				checked.push({ icd10Code: code.code, known: true, title: code.description });
			} catch (error) {
				if (!(error instanceof UnknownIcd10CodeError)) {
					throw error;
				}
				checked.push({ icd10Code: diagnosis.icd10Code.trim().toUpperCase(), known: false, title: null });
			}
		}
		return checked;
	}
}

/**
 * The organization's tests the clinician named: by the standard name or abbreviation (`findLabTest`, e.g. "A1c" →
 * HBA1C), else by the catalog's own code or name. Each test once; a name the catalog lacks is `unmatched`.
 */
export function matchTests(names: readonly string[], catalog: readonly DiagnosticTest[]): ScribeDraftForWise['tests'] {
	const matched: ScribeDraftForWise['tests']['matched'] = [];
	const unmatched: string[] = [];
	for (const name of names) {
		const key = name.trim().toLowerCase();
		const code = findLabTest(name)?.code.toLowerCase();
		const test = catalog.find(
			(candidate) =>
				candidate.code.toLowerCase() === (code ?? key) || candidate.name.trim().toLowerCase() === key,
		);
		if (!test) {
			unmatched.push(name.trim());
		} else if (!matched.some((entry) => entry.testId === test.id)) {
			matched.push({ testId: test.id, code: test.code, name: test.name, category: test.category });
		}
	}
	return { matched, unmatched };
}
