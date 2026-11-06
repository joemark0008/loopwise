import { describe, expect, it } from 'vitest';

import { Prisma } from '../../../generated/prisma/client.js';
import type { ChargeMovementRow } from './inventory-billing.repository.js';
import { toCharges } from './inventory-billing.service.js';

const CLINIC = 'clinic-1';

function movement(
	id: string,
	quantity: number,
	options: { type?: 'DISPENSE' | 'RETURN_FROM_PATIENT'; service?: boolean; clinicPrice?: number } = {},
): ChargeMovementRow {
	return {
		id,
		clinicId: CLINIC,
		itemId: 'amox',
		type: options.type ?? 'DISPENSE',
		quantity: new Prisma.Decimal(quantity),
		prescriptionItemId: 'rx-item-1',
		item: {
			id: 'amox',
			name: 'Amoxicillin 500 mg capsule',
			genericName: 'Amoxicillin',
			brandName: 'Amoxil',
			sellingPrice: new Prisma.Decimal(9),
			taxType: 'VATABLE',
			serviceItem: options.service
				? {
						id: 'svc-amox',
						isActive: true,
						defaultPrice: new Prisma.Decimal(8),
						taxType: 'VAT_EXEMPT',
						clinicPrices:
							options.clinicPrice === undefined
								? []
								: [{ clinicId: CLINIC, price: new Prisma.Decimal(options.clinicPrice) }],
					}
				: null,
		},
	} as unknown as ChargeMovementRow;
}

describe('toCharges', () => {
	it('bills the linked service at the clinic price, net of returns', () => {
		expect(
			toCharges([
				movement('m1', -10, { service: true, clinicPrice: 7.5 }),
				movement('m2', -11, { service: true, clinicPrice: 7.5 }),
				movement('m3', 2, { service: true, clinicPrice: 7.5, type: 'RETURN_FROM_PATIENT' }),
			]),
		).toEqual([
			{
				inventoryItemId: 'amox',
				serviceItemId: 'svc-amox',
				description: 'Amoxicillin 500 mg capsule (Amoxil)',
				quantity: 19,
				unitPrice: 7.5,
				taxType: 'VAT_EXEMPT',
				stockMovementIds: ['m1', 'm2', 'm3'],
				prescriptionItemIds: ['rx-item-1'],
			},
		]);
	});

	it("falls back to the service's default price, then the item's selling price", () => {
		expect(toCharges([movement('m1', -3, { service: true })])[0]).toMatchObject({ unitPrice: 8 });
		expect(toCharges([movement('m1', -3)])[0]).toMatchObject({
			serviceItemId: null,
			unitPrice: 9,
			taxType: 'VATABLE',
		});
	});

	it('drops an item returned in full', () => {
		expect(toCharges([movement('m1', -3), movement('m2', 3, { type: 'RETURN_FROM_PATIENT' })])).toEqual([]);
	});
});
