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

/** An internal referral is answered by the practitioner it was sent to. */
export class NotReferralRecipientError extends DomainError {
	constructor() {
		super('FORBIDDEN', 'NOT_REFERRAL_RECIPIENT', 'Only the doctor this referral was sent to can answer it.');
	}
}

/** Declining needs a reason and completing needs the response notes. */
export class ReferralResponseRequiredError extends DomainError {
	constructor(what: 'reason' | 'notes') {
		super(
			'BAD_REQUEST',
			'REFERRAL_RESPONSE_REQUIRED',
			what === 'reason' ? 'Say why the referral is declined.' : 'Add the response notes: what was found or done.',
		);
	}
}

/** Another response reached the referral first (its status changed since it was read). */
export class ReferralMovedError extends DomainError {
	constructor() {
		super('CONFLICT', 'REFERRAL_MOVED', 'This referral was answered meanwhile. Reload it.');
	}
}

/** The clinic-wide referral list is for clinic admins. */
export class ClinicReferralsAccessError extends DomainError {
	constructor() {
		super('FORBIDDEN', 'CLINIC_REFERRALS_ACCESS', "Only the clinic's admins see every referral of the clinic.");
	}
}

/** The shared rules (`@loopwise/shared/medical-certificate`) refused the draft. */
export class InvalidDocumentDraftError extends DomainError {
	constructor(message: string) {
		super('BAD_REQUEST', 'INVALID_DOCUMENT_DRAFT', message);
	}
}
