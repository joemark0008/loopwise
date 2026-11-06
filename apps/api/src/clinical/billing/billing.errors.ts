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
	constructor(amount: string, balance: string) {
		super(
			'BAD_REQUEST',
			'PAYMENT_EXCEEDS_BALANCE',
			`The payment (₱${amount}) is more than the balance (₱${balance}).`,
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

/** The clinic's BIR series are all past their validity: a new ATP / CAS permit is needed. */
export class InvoiceSeriesExpiredError extends DomainError {
	constructor(seriesId: string) {
		super(
			'CONFLICT',
			'INVOICE_SERIES_EXPIRED',
			"The invoice series' permit has expired. Register a new series before issuing.",
			{ seriesId },
		);
	}
}

/** A new series overlaps the numbers of another one of the clinic (same document type and prefix). */
export class InvoiceSeriesOverlapError extends DomainError {
	constructor(otherSeriesId: string) {
		super('CONFLICT', 'INVOICE_SERIES_OVERLAP', 'These numbers overlap another series of this clinic.', {
			otherSeriesId,
		});
	}
}

/** The SC/PWD discount needs the patient's OSCA / PWD ID on file (RA 9994 / RA 10754). */
export class DiscountIdNotOnFileError extends DomainError {
	constructor() {
		super(
			'BAD_REQUEST',
			'DISCOUNT_ID_NOT_ON_FILE',
			"The senior citizen / PWD ID shown is not on the patient's record. Add it to the patient first.",
		);
	}
}

/** The OSCA / PWD ID on file has expired. */
export class DiscountIdExpiredError extends DomainError {
	constructor() {
		super('BAD_REQUEST', 'DISCOUNT_ID_EXPIRED', 'The senior citizen / PWD ID on file has expired.');
	}
}

/** Another discount needs an approver who may approve it at this clinic. */
export class DiscountApproverInvalidError extends DomainError {
	constructor() {
		super(
			'BAD_REQUEST',
			'DISCOUNT_APPROVER_INVALID',
			'The approver must be an admin of this clinic (or, for a special discount, one of its doctors).',
		);
	}
}

/** A line's doctor must practise at the clinic. */
export class LinePractitionerInvalidError extends DomainError {
	constructor(practitionerId: string) {
		super('BAD_REQUEST', 'LINE_PRACTITIONER_INVALID', "The line's doctor does not practise at this clinic.", {
			practitionerId,
		});
	}
}

/** Payments are taken on an open shift of the cashier (open one first). */
export class NoOpenShiftError extends DomainError {
	constructor() {
		super('CONFLICT', 'NO_OPEN_SHIFT', 'Open your cashier shift before taking payments.');
	}
}

/** One open shift per cashier per clinic. */
export class ShiftAlreadyOpenError extends DomainError {
	constructor(shiftId: string) {
		super('CONFLICT', 'SHIFT_ALREADY_OPEN', 'You already have an open shift at this clinic.', { shiftId });
	}
}

/** A closed shift (Z reading taken) stays closed. */
export class ShiftClosedError extends DomainError {
	constructor(shiftId: string) {
		super('CONFLICT', 'SHIFT_CLOSED', 'This shift is closed.', { shiftId });
	}
}

/** Only the cashier of a shift (or a clinic admin) reads or closes it. */
export class ShiftNotYoursError extends DomainError {
	constructor() {
		super('FORBIDDEN', 'SHIFT_NOT_YOURS', "This is another cashier's shift.");
	}
}

/** A payment's status machine (POSTED → VOIDED | REFUNDED) refused a move. */
export class PaymentNotPostedError extends DomainError {
	constructor(paymentNo: string, status: string) {
		super('CONFLICT', 'PAYMENT_NOT_POSTED', `Payment ${paymentNo} is ${status.toLowerCase()}.`, {
			paymentNo,
			status,
		});
	}
}

/** A payment counted in a closed shift is not voided (the Z reading stands; refund it instead). */
export class PaymentInClosedShiftError extends DomainError {
	constructor(paymentNo: string) {
		super(
			'CONFLICT',
			'PAYMENT_IN_CLOSED_SHIFT',
			`Payment ${paymentNo} was counted in a closed shift; it can no longer be voided.`,
			{ paymentNo },
		);
	}
}

/** An invoice whose doctor's fee was already paid out is not voided. */
export class ProfessionalFeeReleasedError extends DomainError {
	constructor() {
		super(
			'CONFLICT',
			'PROFESSIONAL_FEE_RELEASED',
			"A doctor's fee on this invoice was already released; the invoice can't be voided.",
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
