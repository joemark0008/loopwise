import { Injectable } from '@nestjs/common';

import { groupByEncounter, UserEncounterLoader } from '../encounters/encounter-child.loader.js';
import { ClinicalDbService, type ClinicalTx } from '../rls/clinical-db.service.js';
import type { Prescription } from './models/prescription.model.js';
import { PrescriptionService } from './prescription.service.js';

/** The prescriptions of each visit of the chart's list, as the user, one query per request. */
@Injectable()
export class EncounterPrescriptionsLoader extends UserEncounterLoader<Prescription> {
	constructor(
		db: ClinicalDbService,
		private readonly prescriptions: PrescriptionService,
	) {
		super(db);
	}

	protected async load(tx: ClinicalTx, encounterIds: readonly string[]): Promise<Map<string, Prescription[]>> {
		return groupByEncounter(
			await this.prescriptions.listForEncounters(tx, encounterIds),
			(prescription) => prescription.encounterId,
		);
	}
}
