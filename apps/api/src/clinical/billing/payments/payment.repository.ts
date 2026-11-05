import { Injectable } from '@nestjs/common';

import type { Payment, Prisma } from '../../../generated/prisma/client.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';

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
}
