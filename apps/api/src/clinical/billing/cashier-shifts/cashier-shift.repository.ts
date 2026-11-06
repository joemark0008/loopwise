import { Injectable } from '@nestjs/common';

import { type CashierShift, type PaymentMethod, type PaymentStatus, Prisma } from '../../../generated/prisma/client.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';

export const CASHIER_SHIFT_INCLUDE = {
	cashier: { select: { id: true, name: true, firstName: true, lastName: true } },
} satisfies Prisma.CashierShiftInclude;

export type CashierShiftRow = Prisma.CashierShiftGetPayload<{ include: typeof CASHIER_SHIFT_INCLUDE }>;

export interface MethodTotal {
	method: PaymentMethod;
	status: PaymentStatus;
	count: number;
	amount: Prisma.Decimal;
}

/** `cashier_shifts` and the payments taken on them. Runs inside the caller's (RLS) transaction: the clinic is the boundary. */
@Injectable()
export class CashierShiftRepository {
	findOpen(tx: ClinicalTx, clinicId: string, cashierId: string): Promise<CashierShiftRow | null> {
		return tx.cashierShift.findFirst({
			where: { clinicId, cashierId, closedAt: null },
			include: CASHIER_SHIFT_INCLUDE,
		});
	}

	findById(tx: ClinicalTx, id: string): Promise<CashierShiftRow | null> {
		return tx.cashierShift.findUnique({ where: { id }, include: CASHIER_SHIFT_INCLUDE });
	}

	/** Locks the shift row until the transaction ends (a payment and the Z reading don't cross). */
	async lock(tx: ClinicalTx, id: string): Promise<CashierShift | null> {
		const [row] = await tx.$queryRaw<
			CashierShift[]
		>`SELECT * FROM cashier_shifts WHERE id = ${id}::uuid FOR UPDATE`;
		return row ?? null;
	}

	create(tx: ClinicalTx, data: Prisma.CashierShiftUncheckedCreateInput): Promise<CashierShiftRow> {
		return tx.cashierShift.create({ data, include: CASHIER_SHIFT_INCLUDE });
	}

	/** Closes the shift if it is still open; null when someone closed it first. */
	async close(
		tx: ClinicalTx,
		id: string,
		data: Prisma.CashierShiftUncheckedUpdateManyInput,
	): Promise<CashierShiftRow | null> {
		const { count } = await tx.cashierShift.updateMany({ where: { id, closedAt: null }, data });
		return count === 0 ? null : this.findById(tx, id);
	}

	/** The payments of the shift added up by method and status. */
	async methodTotals(tx: ClinicalTx, shiftId: string): Promise<MethodTotal[]> {
		const groups = await tx.payment.groupBy({
			by: ['method', 'status'],
			where: { cashierShiftId: shiftId },
			_sum: { amount: true },
			_count: { _all: true },
			orderBy: [{ method: 'asc' }, { status: 'asc' }],
		});
		return groups.map((group) => ({
			method: group.method,
			status: group.status,
			count: group._count._all,
			amount: group._sum.amount ?? new Prisma.Decimal(0),
		}));
	}

	/** The clinic's shifts opened in `[from, to)`, newest first. */
	list(
		tx: ClinicalTx,
		filter: { clinicId: string; from: Date; to: Date; cashierId?: string | null },
	): Promise<CashierShiftRow[]> {
		return tx.cashierShift.findMany({
			where: {
				clinicId: filter.clinicId,
				openedAt: { gte: filter.from, lt: filter.to },
				...(filter.cashierId ? { cashierId: filter.cashierId } : {}),
			},
			include: CASHIER_SHIFT_INCLUDE,
			orderBy: { openedAt: 'desc' },
		});
	}
}
