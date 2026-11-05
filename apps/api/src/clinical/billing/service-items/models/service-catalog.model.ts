import { Field, Float, ID, ObjectType } from '@nestjs/graphql';

import type { Prisma } from '../../../../generated/prisma/client.js';
import { ServiceCategory, TaxType } from '../../billing.enums.js';

@ObjectType({
	description: "An item of the organization's catalog with the selected clinic's own prices (Settings → Services).",
})
export class ServiceCatalogItem {
	@Field(() => ID)
	id: string;

	@Field()
	code: string;

	@Field()
	name: string;

	@Field(() => ServiceCategory)
	category: ServiceCategory;

	@Field(() => Float, { description: "The organization's default price (pesos)." })
	defaultPrice: number;

	@Field(() => TaxType)
	taxType: TaxType;

	@Field({ description: 'Part of the fee goes to the practitioner (professional fee).' })
	isPfShareable: boolean;

	@Field(() => ID, { nullable: true })
	diagnosticTestId: string | null;

	@Field(() => String, { nullable: true })
	diagnosticTestName: string | null;

	@Field(() => ID, { nullable: true })
	inventoryItemId: string | null;

	@Field(() => String, { nullable: true })
	inventoryItemName: string | null;

	@Field()
	isActive: boolean;

	@Field(() => Float, { nullable: true, description: "The clinic's own price; null: the default applies." })
	clinicPrice: number | null;

	@Field(() => Float, { nullable: true, description: "The clinic's HMO contracted rate, when different." })
	hmoPrice: number | null;

	@Field(() => Float, { description: 'What the clinic charges: its own price, else the default.' })
	price: number;
}

@ObjectType({ description: 'Something a service item can bill: a lab / imaging test or an inventory item.' })
export class ServiceLinkOption {
	@Field(() => ID)
	id: string;

	@Field()
	name: string;

	@Field({ description: 'Its code (test code or SKU).' })
	code: string;

	@Field(() => ID, { nullable: true, description: 'The service item that already bills it.' })
	linkedServiceItemId: string | null;
}

@ObjectType()
export class ServiceLinkOptions {
	@Field(() => [ServiceLinkOption])
	diagnosticTests: ServiceLinkOption[];

	@Field(() => [ServiceLinkOption])
	inventoryItems: ServiceLinkOption[];
}

export const SERVICE_CATALOG_INCLUDE = (clinicId: string) =>
	({
		clinicPrices: { where: { clinicId }, select: { price: true, hmoPrice: true } },
		diagnosticTest: { select: { name: true } },
		inventoryItem: { select: { name: true } },
	}) satisfies Prisma.ServiceItemInclude;

export type ServiceCatalogRow = Prisma.ServiceItemGetPayload<{
	include: ReturnType<typeof SERVICE_CATALOG_INCLUDE>;
}>;

export function toServiceCatalogItem(row: ServiceCatalogRow): ServiceCatalogItem {
	const own = row.clinicPrices[0];
	return {
		id: row.id,
		code: row.code,
		name: row.name,
		category: row.category,
		defaultPrice: row.defaultPrice.toNumber(),
		taxType: row.taxType,
		isPfShareable: row.isPfShareable,
		diagnosticTestId: row.diagnosticTestId,
		diagnosticTestName: row.diagnosticTest?.name ?? null,
		inventoryItemId: row.inventoryItemId,
		inventoryItemName: row.inventoryItem?.name ?? null,
		isActive: row.isActive,
		clinicPrice: own?.price.toNumber() ?? null,
		hmoPrice: own?.hmoPrice?.toNumber() ?? null,
		price: (own?.price ?? row.defaultPrice).toNumber(),
	};
}
