import { Injectable } from '@nestjs/common';

import { type Payment, type PaymentMethod, Prisma } from '../../../generated/prisma/client.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';

export type PaymentWithAllocations = Prisma.PaymentGetPayload<{ include: { allocations: true } }>;

/** `payments` and `payment_allocations`. Runs inside the caller's (RLS) transaction: the clinic is the boundary. */
@Injectable()
export class PaymentRepository {
	/** A posted payment allocated, whole, to one invoice. */
	create(
		tx: ClinicalTx,
		data: Omit<Prisma.PaymentUncheckedCreateInput, 'allocations'>,
		invoiceId: string,
	): Promise<Payment> {
		return tx.payment.create({
			data: { ...data, allocations: { create: { invoiceId, amount: data.amount } } },
		});
	}

	findById(tx: ClinicalTx, id: string): Promise<PaymentWithAllocations | null> {
		return tx.payment.findUnique({ where: { id }, include: { allocations: true } });
	}

	/** Voids the payment if it is still posted; false when it moved first. */
	async void(
		tx: ClinicalTx,
		id: string,
		data: { voidReason: string; voidedAt: Date; voidedById: string },
	): Promise<boolean> {
		const { count } = await tx.payment.updateMany({
			where: { id, status: 'POSTED' },
			data: { ...data, status: 'VOIDED' },
		});
		return count === 1;
	}

	/** The clinic's posted payments received in `[from, to)`, added up by method. */
	async collectionsByMethod(
		tx: ClinicalTx,
		clinicId: string,
		range: { gte: Date; lt: Date },
	): Promise<{ method: PaymentMethod; count: number; amount: Prisma.Decimal }[]> {
		const groups = await tx.payment.groupBy({
			by: ['method'],
			where: { clinicId, status: 'POSTED', receivedAt: range },
			_sum: { amount: true },
			_count: { _all: true },
			orderBy: { method: 'asc' },
		});
		return groups.map((group) => ({
			method: group.method,
			count: group._count._all,
			amount: group._sum.amount ?? new Prisma.Decimal(0),
		}));
	}
}
