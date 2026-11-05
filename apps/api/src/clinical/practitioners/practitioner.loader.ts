import { Injectable } from '@nestjs/common';

import { LoaderFactory, orderByKeys } from '../../common/dataloader/loader-factory.js';
import { ClinicalDbService } from '../rls/clinical-db.service.js';
import { type Practitioner, toPractitioner } from './models/practitioner.model.js';
import { PractitionerRepository } from './practitioner.repository.js';

/**
 * Practitioners by id, batched per request (the doctor of each visit). Credentials are printed on documents and
 * readable by everyone signed in (policy `practitioners_read`): read as system work.
 */
@Injectable()
export class PractitionerLoader extends LoaderFactory<string, Practitioner> {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly practitioners: PractitionerRepository,
	) {
		super();
	}

	async batch(ids: readonly string[]) {
		const rows = await this.db.asSystem((tx) => this.practitioners.findManyByIds(tx, ids));
		return orderByKeys(ids, rows.map(toPractitioner), (practitioner) => practitioner.id);
	}
}
