import { DomainError } from '../../common/errors/domain-error.js';

/** A cancelled visit's record is closed: nothing is added to it. */
export class EncounterCancelledError extends DomainError {
	constructor(encounterNo: string) {
		super('CONFLICT', 'ENCOUNTER_CANCELLED', `Visit ${encounterNo} was cancelled; its record can't change.`, {
			encounterNo,
		});
	}
}

/** Only staff at the clinic of the visit add to its record (row-level security checks the same). */
export class EncounterClinicAccessError extends DomainError {
	constructor() {
		super('FORBIDDEN', 'ENCOUNTER_CLINIC_ACCESS', 'Only staff at the clinic of the visit can change its record.');
	}
}

/** A visit is created with OPEN (checked in) or IN_PROGRESS (with the doctor); later states come by transition. */
export class InvalidInitialEncounterStatusError extends DomainError {
	constructor(status: string) {
		super('BAD_REQUEST', 'INVALID_INITIAL_ENCOUNTER_STATUS', `A visit can't start as ${status}.`, { status });
	}
}

/** The source chat of an encounter must be the user's own chart chat about the patient. */
export class InvalidSourceChatError extends DomainError {
	constructor() {
		super('BAD_REQUEST', 'INVALID_SOURCE_CHAT', "The source chat isn't your chat about this patient.");
	}
}
