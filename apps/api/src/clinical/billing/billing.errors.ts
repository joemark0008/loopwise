import { DomainError } from '../../common/errors/domain-error.js';

/** An issued invoice is never edited (BIR); void it and bill again. */
export class InvoiceAlreadyIssuedError extends DomainError {
	constructor(invoiceNo: string | null, status: string) {
		super(
			'CONFLICT',
			'INVOICE_ALREADY_ISSUED',
			`${invoiceNo ? `Invoice ${invoiceNo}` : 'This invoice'} is already ${status.toLowerCase().replace('_', ' ')}; void it to bill again.`,
			{ invoiceNo, status },
		);
	}
}

/** A voided invoice stays as it is. */
export class InvoiceVoidedError extends DomainError {
	constructor(invoiceNo: string | null) {
		super('CONFLICT', 'INVOICE_VOIDED', 'This invoice is void.', { invoiceNo });
	}
}

/** A payment larger than what is still due (the change is computed from the amount tendered, not overpaid). */
export class PaymentExceedsBalanceError extends DomainError {
	constructor(amount: number, balance: number) {
		super(
			'BAD_REQUEST',
			'PAYMENT_EXCEEDS_BALANCE',
			`The payment (₱${amount.toFixed(2)}) is more than the balance (₱${balance.toFixed(2)}).`,
			{ amount, balance },
		);
	}
}

/** The clinic's active BIR invoice series has no numbers left: a new ATP / series is needed. */
export class InvoiceSeriesExhaustedError extends DomainError {
	constructor(seriesId: string) {
		super(
			'CONFLICT',
			'INVOICE_SERIES_EXHAUSTED',
			'The invoice series has no numbers left. Register a new series before issuing.',
			{ seriesId },
		);
	}
}

/** The draft failed the shared invoice rules (`@loopwise/shared/invoice`). */
export class InvalidBillingInputError extends DomainError {
	constructor(message: string, field?: string) {
		super('BAD_REQUEST', 'INVALID_BILLING_INPUT', message, field ? { field } : undefined);
	}
}

/** The visit is at another clinic than the one the user is working in. */
export class WrongClinicError extends DomainError {
	constructor() {
		super('FORBIDDEN', 'WRONG_CLINIC', 'This visit is at another clinic. Switch to that clinic to bill it.');
	}
}

/** A service item's code is unique in the organization's catalog. */
export class ServiceItemCodeTakenError extends DomainError {
	constructor(code: string) {
		super('CONFLICT', 'SERVICE_ITEM_CODE_TAKEN', `Another service already has the code ${code}.`, { code });
	}
}

/** A lab test or an inventory item is billed by one service item. */
export class ServiceItemLinkTakenError extends DomainError {
	constructor(field: 'diagnosticTestId' | 'inventoryItemId') {
		super(
			'CONFLICT',
			'SERVICE_ITEM_LINK_TAKEN',
			field === 'diagnosticTestId'
				? 'Another service already bills this test.'
				: 'Another service already bills this inventory item.',
			{ field },
		);
	}
}
