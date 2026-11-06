import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'A medicine, supply or vaccine service of the catalog an inventory item can be sold as.' })
export class InventoryServiceOption {
	@Field(() => ID)
	id: string;

	@Field()
	code: string;

	@Field()
	name: string;

	@Field(() => ID, { nullable: true, description: 'The item the service sells now, when any.' })
	linkedItemId: string | null;

	@Field()
	isActive: boolean;
}
