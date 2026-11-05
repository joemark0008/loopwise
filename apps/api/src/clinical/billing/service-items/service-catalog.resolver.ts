import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { ClinicAdmin } from '../../../common/decorators/access.decorator.js';
import { type ClinicActor, CurrentClinicActor } from '../../clinics/clinic-admin-actor.js';
import { SaveServiceItemInput, SetClinicServicePriceInput } from './dto/service-catalog.input.js';
import { ServiceCatalogItem, ServiceLinkOptions } from './models/service-catalog.model.js';
import { ServiceCatalogService } from './service-catalog.service.js';

/** Settings → Clinic → Services: the organization's catalog and the selected clinic's prices (clinic admins). */
@Resolver(() => ServiceCatalogItem)
export class ServiceCatalogResolver {
	constructor(private readonly catalog: ServiceCatalogService) {}

	@ClinicAdmin()
	@Query(() => [ServiceCatalogItem], { description: "The organization's services at the selected clinic's prices." })
	serviceCatalog(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('includeInactive', { defaultValue: false }) includeInactive: boolean,
	): Promise<ServiceCatalogItem[]> {
		return this.catalog.list(actor, includeInactive);
	}

	@ClinicAdmin()
	@Query(() => ServiceLinkOptions, { description: 'The tests and inventory items a service can bill.' })
	serviceLinkOptions(@CurrentClinicActor() actor: ClinicActor): Promise<ServiceLinkOptions> {
		return this.catalog.linkOptions(actor);
	}

	@ClinicAdmin()
	@Mutation(() => ServiceCatalogItem, { description: 'Adds or changes a service of the catalog (audited).' })
	saveServiceItem(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('input') input: SaveServiceItemInput,
	): Promise<ServiceCatalogItem> {
		return this.catalog.save(actor, input);
	}

	@ClinicAdmin()
	@Mutation(() => ServiceCatalogItem, { description: "Sets the selected clinic's price and HMO rate of a service." })
	setClinicServicePrice(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('input') input: SetClinicServicePriceInput,
	): Promise<ServiceCatalogItem> {
		return this.catalog.setClinicPrice(actor, input);
	}

	@ClinicAdmin()
	@Mutation(() => ServiceCatalogItem, { description: "Removes the clinic's own price: the default applies again." })
	removeClinicServicePrice(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('serviceItemId', { type: () => ID }) serviceItemId: string,
	): Promise<ServiceCatalogItem> {
		return this.catalog.removeClinicPrice(actor, serviceItemId);
	}
}
