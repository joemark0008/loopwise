import { InvalidStatusTransitionError } from '../../../common/errors/domain-error.js';
import type { InvoiceStatus } from '../../../generated/prisma/enums.js';
import { InvoiceAlreadyIssuedError, InvoiceVoidedError } from '../billing.errors.js';

/**
 * The invoice status machine: DRAFT → ISSUED → PARTIALLY_PAID → PAID, and VOID from any of them. A second partial
 * payment keeps PARTIALLY_PAID. Mirrors the `invoices_lock` trigger (migration 0001): once out of DRAFT an invoice
 * never returns to it, only `INVOICE_FIELDS_AFTER_ISSUE` move, and nothing moves once VOID.
 */
export const INVOICE_TRANSITIONS: Readonly<Record<InvoiceStatus, readonly InvoiceStatus[]>> = {
	DRAFT: ['ISSUED', 'VOID'],
	ISSUED: ['PARTIALLY_PAID', 'PAID', 'VOID'],
	PARTIALLY_PAID: ['PARTIALLY_PAID', 'PAID', 'VOID'],
	PAID: ['VOID'],
	VOID: [],
};

/** The columns the `invoices_lock` trigger lets change after DRAFT (plus `updated_at` and `version`). */
export const INVOICE_FIELDS_AFTER_ISSUE = [
	'status',
	'amountPaid',
	'balance',
	'voidedAt',
	'voidedById',
	'voidReason',
] as const;

export function canTransitionInvoice(from: InvoiceStatus, to: InvoiceStatus): boolean {
	return INVOICE_TRANSITIONS[from].includes(to);
}

/** Refuses a move the machine does not allow, with the error that says why. */
export function assertInvoiceTransition(
	invoice: { status: InvoiceStatus; invoiceNo: string | null },
	to: InvoiceStatus,
): void {
	if (canTransitionInvoice(invoice.status, to)) {
		return;
	}
	if (invoice.status === 'VOID') {
		throw new InvoiceVoidedError(invoice.invoiceNo);
	}
	if (to === 'ISSUED' && invoice.status !== 'DRAFT') {
		throw new InvoiceAlreadyIssuedError(invoice.invoiceNo, invoice.status);
	}
	throw new InvalidStatusTransitionError('Invoice', invoice.status, to);
}

/** Only a draft's lines, discounts, buyer and totals may be edited. */
export function assertInvoiceEditable(invoice: { status: InvoiceStatus; invoiceNo: string | null }): void {
	if (invoice.status === 'VOID') {
		throw new InvoiceVoidedError(invoice.invoiceNo);
	}
	if (invoice.status !== 'DRAFT') {
		throw new InvoiceAlreadyIssuedError(invoice.invoiceNo, invoice.status);
	}
}
