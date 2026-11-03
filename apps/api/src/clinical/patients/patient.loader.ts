import { Injectable } from '@nestjs/common';

import { LoaderFactory, orderByKeys } from '../../common/dataloader/loader-factory.js';
import { OrganizationRepository } from '../../organizations/organization.repository.js';
import type { Facility } from './models/patient.model.js';

/** Facilities by id, batched per request (the facility of each patient identifier). */
@Injectable()
export class FacilityLoader extends LoaderFactory<string, Facility> {
	constructor(private readonly organizations: OrganizationRepository) {
		super();
	}

	async batch(ids: readonly string[]) {
		const rows = await this.organizations.getOrganizationsByIds(ids);
		return orderByKeys(
			ids,
			rows.map(({ id, name, slug, type }) => ({ id, name, slug, type })),
			(facility) => facility.id,
		);
	}
}
