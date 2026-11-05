import { DomainError } from '../../common/errors/domain-error.js';

/** A card confirms only from the user's own chat, and only the mutations its tool is meant for. */
export class WiseCardInvalidError extends DomainError {
	constructor(message: string) {
		super('BAD_REQUEST', 'WISE_CARD_INVALID', message);
	}
}

/** A card drafted in one patient's chart chat can't change another patient's record. */
export class WiseCardOtherPatientError extends DomainError {
	constructor() {
		super('BAD_REQUEST', 'WISE_CARD_OTHER_PATIENT', 'This Wise card is about another patient.');
	}
}

/** A card is settled once (DESIGN.md §7.1): a second Confirm (reload, second tab) saves nothing. */
export class WiseCardAlreadySettledError extends DomainError {
	constructor(status: string) {
		super(
			'CONFLICT',
			'WISE_CARD_ALREADY_SETTLED',
			status === 'cancelled'
				? 'This Wise card was cancelled, so it can no longer be confirmed. Ask Wise for a new draft.'
				: 'This Wise card was already confirmed; nothing was saved twice.',
			{ status },
		);
	}
}
