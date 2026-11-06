import type { PaymentStatus } from '../../../generated/prisma/enums.js';
import { PaymentNotPostedError } from '../billing.errors.js';

/**
 * A payment's status machine: POSTED → VOIDED (a mistake, with a reason, while its shift is open) or REFUNDED (money
 * given back; not offered yet). VOIDED and REFUNDED are final.
 */
export const PAYMENT_TRANSITIONS: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> = {
	POSTED: ['VOIDED', 'REFUNDED'],
	VOIDED: [],
	REFUNDED: [],
};

export function assertPaymentTransition(payment: { paymentNo: string; status: PaymentStatus }, to: PaymentStatus) {
	if (!PAYMENT_TRANSITIONS[payment.status].includes(to)) {
		throw new PaymentNotPostedError(payment.paymentNo, payment.status);
	}
}
