import { Field, Float, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

import type { Prisma } from '../../../generated/prisma/client.js';
import { BillDiscountKind, BillStatus, ChargeKind } from '../../../generated/prisma/enums.js';

registerEnumType(BillStatus, {
	name: 'BillStatus',
	description: 'Draft (editable), finalized (locked), paid, voided.',
});
registerEnumType(ChargeKind, { name: 'ChargeKind' });
registerEnumType(BillDiscountKind, { name: 'BillDiscountKind', description: 'The 20% senior citizen / PWD discount.' });

@ObjectType()
export class EncounterCharge {
	@Field(() => ID)
	id: string;

	@Field(() => Int)
	position: number;

	@Field(() => ChargeKind)
	kind: ChargeKind;

	@Field()
	description: string;

	@Field(() => String, { nullable: true })
	code: string | null;

	@Field(() => Int)
	quantity: number;

	@Field(() => Float, { description: 'Pesos.' })
	unitPrice: number;

	@Field(() => Float, { description: 'Pesos: quantity × unit price.' })
	amount: number;
}

@ObjectType({ description: 'The bill of an encounter (DESIGN.md §7). Amounts in pesos.' })
export class EncounterBill {
	@Field(() => ID)
	id: string;

	@Field(() => ID)
	encounterId: string;

	@Field(() => BillStatus)
	status: BillStatus;

	@Field(() => Int, { description: 'Moves on every change; pass it back as `expectedVersion`.' })
	version: number;

	@Field(() => [EncounterCharge])
	charges: EncounterCharge[];

	@Field(() => Float)
	subtotal: number;

	@Field(() => BillDiscountKind, { nullable: true })
	discountKind: BillDiscountKind | null;

	@Field(() => Float)
	discountAmount: number;

	@Field(() => String, { nullable: true })
	philhealthPackageCode: string | null;

	@Field(() => Float)
	philhealthCoverage: number;

	@Field(() => Float, { description: 'What the patient pays.' })
	total: number;

	@Field(() => Date, { nullable: true })
	finalizedAt: Date | null;

	@Field(() => Date, { nullable: true })
	paidAt: Date | null;

	@Field(() => String, { nullable: true, description: 'Official receipt number.' })
	orNumber: string | null;

	@Field(() => Date, { nullable: true })
	voidedAt: Date | null;

	@Field(() => String, { nullable: true })
	voidReason: string | null;

	@Field()
	createdAt: Date;
}

export type BillRow = Prisma.EncounterBillGetPayload<{ include: { charges: true } }>;

export function toEncounterBill(row: BillRow): EncounterBill {
	return {
		id: row.id,
		encounterId: row.encounterId,
		status: row.status,
		version: row.version,
		charges: [...row.charges]
			.sort((a, b) => a.position - b.position)
			.map((charge) => ({
				id: charge.id,
				position: charge.position,
				kind: charge.kind,
				description: charge.description,
				code: charge.code,
				quantity: charge.quantity,
				unitPrice: charge.unitPrice.toNumber(),
				amount: charge.amount.toNumber(),
			})),
		subtotal: row.subtotal.toNumber(),
		discountKind: row.discountKind,
		discountAmount: row.discountAmount.toNumber(),
		philhealthPackageCode: row.philhealthPackageCode,
		philhealthCoverage: row.philhealthCoverage.toNumber(),
		total: row.total.toNumber(),
		finalizedAt: row.finalizedAt,
		paidAt: row.paidAt,
		orNumber: row.orNumber,
		voidedAt: row.voidedAt,
		voidReason: row.voidReason,
		createdAt: row.createdAt,
	};
}
