import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

import { Prisma } from '../../../../generated/prisma/client.js';
import { PaymentMethod } from '../../billing.enums.js';
import type { CashierShiftRow, MethodTotal } from '../cashier-shift.repository.js';

@ObjectType({ description: 'The posted payments of one method on a shift (pesos).' })
export class ShiftMethodTotal {
	@Field(() => PaymentMethod)
	method: PaymentMethod;

	@Field(() => Int)
	count: number;

	@Field(() => Float)
	amount: number;
}

@ObjectType({ description: 'A bill or coin counted at the Z reading.' })
export class CashDenominationCount {
	@Field(() => Float, { description: 'Pesos, e.g. 1000 or 0.25.' })
	denomination: number;

	@Field(() => Int)
	count: number;
}

@ObjectType({
	description:
		"A cashier's shift with its reading: the X reading (open, mid-shift) or the Z reading (closed: counted cash and variance).",
})
export class CashierShift {
	@Field(() => ID)
	id: string;

	@Field(() => ID)
	cashierId: string;

	@Field()
	cashierName: string;

	@Field()
	openedAt: Date;

	@Field(() => Date, { nullable: true })
	closedAt: Date | null;

	@Field()
	isOpen: boolean;

	@Field(() => Float)
	openingCash: number;

	@Field(() => [ShiftMethodTotal], { description: 'Posted payments by method.' })
	byMethod: ShiftMethodTotal[];

	@Field(() => Int)
	paymentCount: number;

	@Field(() => Float, { description: 'All posted payments.' })
	totalCollected: number;

	@Field(() => Float, { description: 'Posted cash payments.' })
	cashCollected: number;

	@Field(() => Int)
	voidedCount: number;

	@Field(() => Float)
	voidedAmount: number;

	@Field(() => Float, { description: 'Opening cash + cash collected (at the Z reading: as stored then).' })
	expectedCash: number;

	@Field(() => Float, { nullable: true, description: 'Z reading: the cash counted.' })
	countedCash: number | null;

	@Field(() => Float, { nullable: true, description: 'Z reading: counted − expected (negative = short).' })
	variance: number | null;

	@Field(() => [CashDenominationCount])
	denominations: CashDenominationCount[];

	@Field(() => String, { nullable: true })
	remarks: string | null;
}

const ZERO = new Prisma.Decimal(0);

/** The shift with its totals; `totals` are the payments grouped by method and status. */
export function toCashierShift(row: CashierShiftRow, totals: readonly MethodTotal[]): CashierShift {
	const posted = totals.filter((total) => total.status === 'POSTED');
	const voided = totals.filter((total) => total.status === 'VOIDED');
	const add = (list: readonly MethodTotal[]) => list.reduce((sum, total) => sum.plus(total.amount), ZERO);
	const cash = add(posted.filter((total) => total.method === 'CASH'));
	const expected = row.expectedCash ?? row.openingCash.plus(cash);
	const denominations = Object.entries((row.denominations ?? {}) as Record<string, number>)
		.map(([denomination, count]) => ({ denomination: Number(denomination), count }))
		.sort((a, b) => b.denomination - a.denomination);
	return {
		id: row.id,
		cashierId: row.cashierId,
		cashierName: row.cashier.name || `${row.cashier.firstName} ${row.cashier.lastName}`.trim(),
		openedAt: row.openedAt,
		closedAt: row.closedAt,
		isOpen: row.closedAt === null,
		openingCash: row.openingCash.toNumber(),
		byMethod: posted.map((total) => ({
			method: total.method,
			count: total.count,
			amount: total.amount.toNumber(),
		})),
		paymentCount: posted.reduce((sum, total) => sum + total.count, 0),
		totalCollected: add(posted).toNumber(),
		cashCollected: cash.toNumber(),
		voidedCount: voided.reduce((sum, total) => sum + total.count, 0),
		voidedAmount: add(voided).toNumber(),
		expectedCash: expected.toNumber(),
		countedCash: row.countedCash?.toNumber() ?? null,
		variance: row.variance?.toNumber() ?? null,
		denominations,
		remarks: row.remarks,
	};
}
