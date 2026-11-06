import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

import type { Prisma } from '../../../../generated/prisma/client.js';
import { TaxType } from '../../../billing/billing.enums.js';
import { ItemCategory } from '../../inventory.enums.js';
import { itemDisplayName } from '../../stock/models/stock.model.js';
import { dateOnly, isExpired, isLowStock, round2 } from '../../stock/stock-rules.js';

@ObjectType({ description: 'The catalog service that sells an inventory item (Settings → Services owns it).' })
export class InventoryServiceLink {
	@Field(() => ID)
	id: string;

	@Field()
	code: string;

	@Field()
	name: string;

	@Field(() => Float, { description: "The selected clinic's price, else the default price." })
	price: number;
}

@ObjectType({ description: "An item of the organization's inventory master (`inventory_items`), with its stock here." })
export class InventoryItemModel {
	@Field(() => ID)
	id: string;

	@Field()
	sku: string;

	@Field(() => String, { nullable: true })
	barcode: string | null;

	@Field({ description: 'Display name, generic name first (RA 6675).' })
	name: string;

	@Field({ description: 'The name with the brand after it: "Amoxicillin 500 mg capsule (Amoxil)".' })
	displayName: string;

	@Field(() => ItemCategory)
	category: ItemCategory;

	@Field(() => String, { nullable: true })
	genericName: string | null;

	@Field(() => String, { nullable: true })
	brandName: string | null;

	@Field(() => String, { nullable: true })
	strength: string | null;

	@Field(() => String, { nullable: true })
	dosageForm: string | null;

	@Field(() => String, { nullable: true })
	manufacturer: string | null;

	@Field(() => String, { nullable: true, description: 'FDA Certificate of Product Registration.' })
	fdaCprNo: string | null;

	@Field()
	isRxOnly: boolean;

	@Field({ description: 'A dangerous drug (RA 9165): dispensed only against an S2 prescription.' })
	isDangerousDrug: boolean;

	@Field({ description: 'Reported for antimicrobial stewardship.' })
	isAntimicrobial: boolean;

	@Field({ description: 'Listed in the Philippine National Formulary.' })
	isPnf: boolean;

	@Field(() => String, { nullable: true, description: 'e.g. "2–8°C", "Store below 30°C".' })
	storageCondition: string | null;

	@Field({ description: 'tab, cap, vial, bottle, pc …' })
	unitOfMeasure: string;

	@Field(() => Int, { nullable: true, description: 'Units per box.' })
	packSize: number | null;

	@Field(() => TaxType)
	taxType: TaxType;

	@Field(() => Float, { nullable: true })
	defaultCost: number | null;

	@Field(() => Float, { nullable: true })
	sellingPrice: number | null;

	@Field(() => Float, { nullable: true })
	reorderLevel: number | null;

	@Field()
	isActive: boolean;

	@Field(() => InventoryServiceLink, { nullable: true })
	serviceItem: InventoryServiceLink | null;

	@Field(() => Float, { description: 'Stock on hand at the selected clinic, every lot.' })
	onHand: number;

	@Field(() => Float, { description: 'Unexpired stock on hand at the selected clinic (what can be dispensed).' })
	usableOnHand: number;

	@Field(() => String, { nullable: true, description: 'The earliest expiry of an unexpired lot in stock.' })
	nearestExpiry: string | null;

	@Field({ description: 'Unexpired stock at or below the reorder level.' })
	isLowStock: boolean;
}

export const itemInclude = (clinicId: string) =>
	({
		serviceItem: {
			select: {
				id: true,
				code: true,
				name: true,
				defaultPrice: true,
				clinicPrices: { where: { clinicId }, select: { price: true } },
			},
		},
		lots: { where: { clinicId, quantityOnHand: { gt: 0 } }, select: { quantityOnHand: true, expiryDate: true } },
	}) satisfies Prisma.InventoryItemInclude;

export type InventoryItemRow = Prisma.InventoryItemGetPayload<{ include: ReturnType<typeof itemInclude> }>;

export function toInventoryItem(row: InventoryItemRow, today: string): InventoryItemModel {
	const lots = row.lots.map((lot) => ({ quantity: lot.quantityOnHand.toNumber(), expiry: dateOnly(lot.expiryDate) }));
	const usable = lots.filter((lot) => !isExpired(lot.expiry, today));
	const usableOnHand = round2(usable.reduce((sum, lot) => sum + lot.quantity, 0));
	const reorderLevel = row.reorderLevel?.toNumber() ?? null;
	const service = row.serviceItem;
	return {
		id: row.id,
		sku: row.sku,
		barcode: row.barcode,
		name: row.name,
		displayName: itemDisplayName(row),
		category: row.category,
		genericName: row.genericName,
		brandName: row.brandName,
		strength: row.strength,
		dosageForm: row.dosageForm,
		manufacturer: row.manufacturer,
		fdaCprNo: row.fdaCprNo,
		isRxOnly: row.isRxOnly,
		isDangerousDrug: row.isDangerousDrug,
		isAntimicrobial: row.isAntimicrobial,
		isPnf: row.isPnf,
		storageCondition: row.storageCondition,
		unitOfMeasure: row.unitOfMeasure,
		packSize: row.packSize,
		taxType: row.taxType,
		defaultCost: row.defaultCost?.toNumber() ?? null,
		sellingPrice: row.sellingPrice?.toNumber() ?? null,
		reorderLevel,
		isActive: row.isActive,
		serviceItem: service
			? {
					id: service.id,
					code: service.code,
					name: service.name,
					price: (service.clinicPrices[0]?.price ?? service.defaultPrice).toNumber(),
				}
			: null,
		onHand: round2(lots.reduce((sum, lot) => sum + lot.quantity, 0)),
		usableOnHand,
		nearestExpiry:
			usable
				.map((lot) => lot.expiry)
				.filter((expiry): expiry is string => expiry !== null)
				.sort()[0] ?? null,
		isLowStock: row.isActive && isLowStock(usableOnHand, reorderLevel),
	};
}
