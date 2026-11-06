import { DomainError } from '../../common/errors/domain-error.js';

/** Another item of the organization already has this SKU. */
export class InventorySkuTakenError extends DomainError {
	constructor(sku: string) {
		super('CONFLICT', 'INVENTORY_SKU_TAKEN', `Another item already has SKU ${sku}.`, { sku });
	}
}

/** The service already sells another inventory item (a service bills one item). */
export class ServiceItemAlreadyLinkedError extends DomainError {
	constructor(serviceCode: string) {
		super(
			'CONFLICT',
			'SERVICE_ITEM_ALREADY_LINKED',
			`Service ${serviceCode} already sells another item. Unlink it there first.`,
			{ serviceCode },
		);
	}
}

/** A lot would go below zero. */
export class InsufficientStockError extends DomainError {
	constructor(itemName: string, available: number, requested: number) {
		super(
			'CONFLICT',
			'INSUFFICIENT_STOCK',
			`Not enough ${itemName} in stock: ${available} available, ${requested} needed.`,
			{ itemName, available, requested },
		);
	}
}

/** Expired stock is never dispensed or used (only disposed of). */
export class ExpiredLotError extends DomainError {
	constructor(lotNo: string, expiryDate: string) {
		super('CONFLICT', 'LOT_EXPIRED', `Lot ${lotNo} expired on ${expiryDate}; dispose of it instead.`, {
			lotNo,
			expiryDate,
		});
	}
}

/** Only an expired lot is disposed of as expired. */
export class LotNotExpiredError extends DomainError {
	constructor(lotNo: string) {
		super(
			'BAD_REQUEST',
			'LOT_NOT_EXPIRED',
			`Lot ${lotNo} hasn't expired; record an adjustment or damage instead.`,
			{
				lotNo,
			},
		);
	}
}

/** A delivery line whose lot is already past its expiry date. */
export class ExpiredOnReceiptError extends DomainError {
	constructor(lotNo: string, expiryDate: string) {
		super('BAD_REQUEST', 'EXPIRED_ON_RECEIPT', `Lot ${lotNo} expired on ${expiryDate}; don't receive it.`, {
			lotNo,
			expiryDate,
		});
	}
}

/** The same lot number came with another expiry date than the one on file. */
export class LotExpiryMismatchError extends DomainError {
	constructor(lotNo: string, onFile: string | null) {
		super(
			'CONFLICT',
			'LOT_EXPIRY_MISMATCH',
			`Lot ${lotNo} is on file with expiry ${onFile ?? 'not set'}. Check the lot number and expiry on the box.`,
			{ lotNo, onFile },
		);
	}
}

/** The lot is of another item or another clinic than the one asked for. */
export class LotMismatchError extends DomainError {
	constructor(lotNo: string) {
		super('BAD_REQUEST', 'LOT_MISMATCH', `Lot ${lotNo} is not a lot of this item at this clinic.`, { lotNo });
	}
}

/** The item given in place of the prescribed one is not the same generic (RA 6675 allows only an equivalent). */
export class NotEquivalentError extends DomainError {
	constructor(prescribed: string, offered: string) {
		super(
			'BAD_REQUEST',
			'NOT_EQUIVALENT_GENERIC',
			`${offered} is not the prescribed generic (${prescribed}). Only an equivalent generic can be substituted.`,
			{ prescribed, offered },
		);
	}
}

/** RA 9165: a dangerous drug is dispensed only against a complete S2 prescription. */
export class DangerousDrugRxIncompleteError extends DomainError {
	constructor(missing: string) {
		super(
			'BAD_REQUEST',
			'DANGEROUS_DRUG_RX_INCOMPLETE',
			`This is a dangerous drug (RA 9165): the prescription needs ${missing} before it is dispensed.`,
			{ missing },
		);
	}
}

/** The prescription's validity has passed. */
export class PrescriptionExpiredForDispenseError extends DomainError {
	constructor(rxNo: string, validUntil: string) {
		super('CONFLICT', 'PRESCRIPTION_EXPIRED', `Prescription ${rxNo} was valid until ${validUntil}.`, {
			rxNo,
			validUntil,
		});
	}
}

/** The prescription or visit is at another clinic than the pharmacy working it. */
export class OtherClinicError extends DomainError {
	constructor(what: string) {
		super('FORBIDDEN', 'OTHER_CLINIC', `This ${what} is at another clinic. Switch to that clinic to work on it.`);
	}
}

/** Invalid input a DTO can't express (a bad date, an empty delivery). */
export class InvalidInventoryInputError extends DomainError {
	constructor(message: string, field?: string) {
		super('BAD_REQUEST', 'INVALID_INVENTORY_INPUT', message, field ? { field } : undefined);
	}
}

/** The user doesn't work the pharmacy or stock room of the clinic. */
export class InventoryDeskAccessError extends DomainError {
	constructor(desk: string) {
		super('FORBIDDEN', 'INVENTORY_DESK_DENIED', `Only the ${desk} of this clinic can do this.`, { desk });
	}
}
