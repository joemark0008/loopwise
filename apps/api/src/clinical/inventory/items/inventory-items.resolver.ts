import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { ClinicAccess } from '../../../common/decorators/access.decorator.js';
import { type ClinicActor, CurrentClinicActor } from '../../clinics/clinic-admin-actor.js';
import { ItemCategory } from '../inventory.enums.js';
import { INVENTORY_DESKS } from '../inventory-access.js';
import { SaveInventoryItemInput, SetInventoryServiceLinkInput } from './dto/inventory-item.input.js';
import { InventoryItemService } from './inventory-item.service.js';
import { InventoryItemModel } from './models/inventory-item.model.js';
import { InventoryServiceOption } from './models/inventory-service-option.model.js';

/** Pharmacy → Items: the organization's inventory master with stock at the selected clinic. */
@Resolver(() => InventoryItemModel)
export class InventoryItemsResolver {
	constructor(private readonly items: InventoryItemService) {}

	@ClinicAccess({ staffRoles: INVENTORY_DESKS.read })
	@Query(() => [InventoryItemModel], {
		description: "The organization's inventory items (generic name first) with their stock at the selected clinic.",
	})
	inventoryItems(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('search', { type: () => String, nullable: true }) search?: string | null,
		@Args('category', { type: () => ItemCategory, nullable: true }) category?: ItemCategory | null,
		@Args('includeInactive', { defaultValue: false }) includeInactive?: boolean,
	): Promise<InventoryItemModel[]> {
		return this.items.list(actor, { search, category, includeInactive });
	}

	@ClinicAccess({ staffRoles: INVENTORY_DESKS.read })
	@Query(() => InventoryItemModel, { description: 'One inventory item with its stock at the selected clinic.' })
	inventoryItem(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('id', { type: () => ID }) id: string,
	): Promise<InventoryItemModel> {
		return this.items.get(actor, id);
	}

	@ClinicAccess({ staffRoles: INVENTORY_DESKS.read })
	@Query(() => [InventoryServiceOption], { description: 'The catalog services an inventory item can be sold as.' })
	inventoryServiceOptions(@CurrentClinicActor() actor: ClinicActor): Promise<InventoryServiceOption[]> {
		return this.items.serviceOptions(actor);
	}

	@ClinicAccess({ staffRoles: INVENTORY_DESKS.stock })
	@Mutation(() => InventoryItemModel, { description: 'Adds or changes an inventory item (audited).' })
	saveInventoryItem(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('input') input: SaveInventoryItemInput,
	): Promise<InventoryItemModel> {
		return this.items.save(actor, input);
	}

	@ClinicAccess({ staffRoles: INVENTORY_DESKS.stock })
	@Mutation(() => InventoryItemModel, {
		description: 'Links the item to the catalog service that sells it (audited).',
	})
	setInventoryServiceLink(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('input') input: SetInventoryServiceLinkInput,
	): Promise<InventoryItemModel> {
		return this.items.setServiceLink(actor, input);
	}
}
