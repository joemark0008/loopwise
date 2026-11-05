import { Injectable } from '@nestjs/common';

import { LoaderFactory, orderByKeys } from '../../common/dataloader/loader-factory.js';
import { ClinicalDbService } from '../rls/clinical-db.service.js';
import { toClinicRef } from './care-clinic.service.js';
import type { ClinicRef } from './models/clinic-ref.model.js';
import { PatientRepository } from './patient.repository.js';

/**
 * Clinics by id, batched per request (the clinic of each encounter). Names and codes are not patient data: read as
 * system work, the same for everyone signed in.
 */
@Injectable()
export class ClinicRefLoader extends LoaderFactory<string, ClinicRef> {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly patients: PatientRepository,
	) {
		super();
	}

	async batch(ids: readonly string[]) {
		const rows = await this.db.asSystem((tx) => this.patients.findClinics(tx, ids));
		return orderByKeys(ids, rows.map(toClinicRef), (clinic) => clinic.id);
	}
}
