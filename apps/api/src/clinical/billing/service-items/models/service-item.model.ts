import { Field, Float, ID, ObjectType } from '@nestjs/graphql';

import type { Prisma } from '../../../../generated/prisma/client.js';
import { ServiceCategory, TaxType } from '../../billing.enums.js';

@ObjectType({ description: "An item of the organization's price list, at the clinic's price (pesos)." })
export class ServiceItemPrice {
	@Field(() => ID)
	id: string;

	@Field()
	code: string;

	@Field()
	name: string;

	@Field(() => ServiceCategory)
	category: ServiceCategory;

	@Field(() => Float, { description: "The clinic's price, else the organization's default." })
	price: number;

	@Field(() => TaxType)
	taxType: TaxType;

	@Field(() => ID, { nullable: true, description: 'The lab or imaging test this item bills.' })
	diagnosticTestId: string | null;

	@Field(() => ID, { nullable: true, description: 'The stock item (medicine, supply) this item bills.' })
	inventoryItemId: string | null;

	@Field({ description: "A doctor's professional fee (or a share of it): the line names the doctor." })
	isPfShareable: boolean;
}

export const SERVICE_ITEM_PRICE_INCLUDE = (clinicId: string) =>
	({ clinicPrices: { where: { clinicId }, select: { price: true } } }) satisfies Prisma.ServiceItemInclude;

export type ServiceItemPriceRow = Prisma.ServiceItemGetPayload<{
	include: { clinicPrices: { select: { price: true } } };
}>;

export function toServiceItemPrice(row: ServiceItemPriceRow): ServiceItemPrice {
	return {
		id: row.id,
		code: row.code,
		name: row.name,
		category: row.category,
		price: (row.clinicPrices[0]?.price ?? row.defaultPrice).toNumber(),
		taxType: row.taxType,
		diagnosticTestId: row.diagnosticTestId,
		inventoryItemId: row.inventoryItemId,
		isPfShareable: row.isPfShareable,
	};
}
