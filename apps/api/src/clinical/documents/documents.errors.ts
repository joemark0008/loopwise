import { DomainError } from '../../common/errors/domain-error.js';

/** An issued prescription or certificate is never edited: void it and write a new one. */
export class DocumentAlreadyIssuedError extends DomainError {
	constructor(label: string, number: string) {
		super(
			'CONFLICT',
			'DOCUMENT_ALREADY_ISSUED',
			`This ${label} (${number}) is issued; void it and write a new one.`,
			{
				number,
			},
		);
	}
}

/** A voided document stays as it is. */
export class DocumentVoidedError extends DomainError {
	constructor(label: string, number: string) {
		super('CONFLICT', 'DOCUMENT_VOIDED', `This ${label} (${number}) is void.`, { number });
	}
}

/** A document id that belongs to another visit than the one named. */
export class DocumentEncounterMismatchError extends DomainError {
	constructor() {
		super('BAD_REQUEST', 'DOCUMENT_ENCOUNTER_MISMATCH', 'This document belongs to another visit.');
	}
}

/** Only a referral still on its way can be cancelled. */
export class ReferralNotCancellableError extends DomainError {
	constructor(status: string) {
		super('CONFLICT', 'REFERRAL_NOT_CANCELLABLE', `A ${status.toLowerCase()} referral can't be cancelled.`, {
			status,
		});
	}
}

/** The shared rules (`@loopwise/shared/medical-certificate`) refused the draft. */
export class InvalidDocumentDraftError extends DomainError {
	constructor(message: string) {
		super('BAD_REQUEST', 'INVALID_DOCUMENT_DRAFT', message);
	}
}
