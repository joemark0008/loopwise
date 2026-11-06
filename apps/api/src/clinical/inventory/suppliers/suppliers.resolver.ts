import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { ClinicAccess } from '../../../common/decorators/access.decorator.js';
import { type ClinicActor, CurrentClinicActor } from '../../clinics/clinic-admin-actor.js';
import { INVENTORY_DESKS } from '../inventory-access.js';
import { SaveSupplierInput } from './dto/supplier.input.js';
import { SupplierModel } from './models/supplier.model.js';
import { SupplierService } from './supplier.service.js';

/** Pharmacy → Suppliers. */
@Resolver(() => SupplierModel)
export class SuppliersResolver {
	constructor(private readonly service: SupplierService) {}

	@ClinicAccess({ staffRoles: INVENTORY_DESKS.read })
	@Query(() => [SupplierModel], { description: "The organization's suppliers." })
	suppliers(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('includeInactive', { defaultValue: false }) includeInactive: boolean,
	): Promise<SupplierModel[]> {
		return this.service.list(actor, includeInactive);
	}

	@ClinicAccess({ staffRoles: INVENTORY_DESKS.stock })
	@Mutation(() => SupplierModel, { description: 'Adds or changes a supplier (audited).' })
	saveSupplier(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('input') input: SaveSupplierInput,
	): Promise<SupplierModel> {
		return this.service.save(actor, input);
	}
}
