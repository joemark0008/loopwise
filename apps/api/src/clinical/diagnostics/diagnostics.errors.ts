import { DomainError } from '../../common/errors/domain-error.js';

/** A test the organization's catalog does not hold (or no longer offers) was ordered. */
export class DiagnosticTestNotOrderableError extends DomainError {
	constructor() {
		super('BAD_REQUEST', 'DIAGNOSTIC_TEST_NOT_ORDERABLE', "Pick tests from the clinic's test list.");
	}
}

/** Orders go on a visit that still runs; a cancelled visit takes none. */
export class EncounterNotOrderableError extends DomainError {
	constructor(encounterNo: string) {
		super('CONFLICT', 'ENCOUNTER_NOT_ORDERABLE', `Visit ${encounterNo} is cancelled; it takes no orders.`, {
			encounterNo,
		});
	}
}

/** A request needs its physician: the signed-in practitioner, or the outside doctor named on a walk-in request. */
export class RequestingPhysicianRequiredError extends DomainError {
	constructor() {
		super(
			'BAD_REQUEST',
			'REQUESTING_PHYSICIAN_REQUIRED',
			"Only a physician can request tests. For an outside doctor's request, name the doctor.",
		);
	}
}

/** Only the requesting doctor or the lab of the visit's clinic cancels a test. */
export class NotAllowedToCancelOrderError extends DomainError {
	constructor() {
		super(
			'FORBIDDEN',
			'NOT_ALLOWED_TO_CANCEL_ORDER',
			"Only the doctor who requested the test, or the clinic's lab, can cancel it.",
		);
	}
}

/** A cancellation, a refusal or a correction needs the reason the other side sees. */
export class ReasonRequiredError extends DomainError {
	constructor() {
		super('BAD_REQUEST', 'REASON_REQUIRED', 'Give a reason.');
	}
}

/** Nothing on the order can be cancelled any more (every test has its result, or was cancelled). */
export class NothingToCancelError extends DomainError {
	constructor(orderNo: string) {
		super('CONFLICT', 'NOTHING_TO_CANCEL', `Order ${orderNo} has no test left that can be cancelled.`, { orderNo });
	}
}

/** The lab worklist is for the clinic's lab staff (MEDTECH, RADTECH) and its admins. */
export class LabDeskAccessDeniedError extends DomainError {
	constructor() {
		super('FORBIDDEN', 'LAB_DESK_ACCESS_DENIED', "Only the clinic's lab staff can do this.");
	}
}

/** A result needs its values (a laboratory test) or its findings / impression (imaging). */
export class ResultContentRequiredError extends DomainError {
	constructor() {
		super(
			'BAD_REQUEST',
			'RESULT_CONTENT_REQUIRED',
			'Enter the values, or the findings and impression of the report.',
		);
	}
}

/** A value names an analyte that is not one of the test's parameters, or names it twice. */
export class UnknownResultParameterError extends DomainError {
	constructor(name: string) {
		super('BAD_REQUEST', 'UNKNOWN_RESULT_PARAMETER', `${name} is not an analyte of this test, or appears twice.`, {
			name,
		});
	}
}

/** A value that does not fit its analyte (not a number, not one of the options). */
export class InvalidResultValueError extends DomainError {
	constructor(name: string, expected: string) {
		super('BAD_REQUEST', 'INVALID_RESULT_VALUE', `${name}: enter ${expected}.`, { name });
	}
}

/** Critical is for a value outside its reference range (the lab calls it in). */
export class InvalidCriticalFlagError extends DomainError {
	constructor(name: string) {
		super(
			'BAD_REQUEST',
			'INVALID_CRITICAL_FLAG',
			`${name}: only a value outside its reference range can be marked critical.`,
			{ name },
		);
	}
}

/** The doctor reviews only results the lab released. */
export class ResultNotReleasedError extends DomainError {
	constructor() {
		super('CONFLICT', 'RESULT_NOT_RELEASED', 'This result is not released yet.');
	}
}

export class ResultAlreadyReviewedError extends DomainError {
	constructor() {
		super('CONFLICT', 'RESULT_ALREADY_REVIEWED', 'This result was already reviewed.');
	}
}

/** Reviewing is for the requesting doctor, the visit's doctor or a doctor in the patient's care team. */
export class NotResultReviewerError extends DomainError {
	constructor() {
		super(
			'FORBIDDEN',
			'NOT_RESULT_REVIEWER',
			"Only the requesting doctor, the visit's doctor or the patient's care team reviews this result.",
		);
	}
}

/** Confirming a critical result from a Wise card needs the clinician's note of what they did. */
export class CriticalReviewNoteRequiredError extends DomainError {
	constructor() {
		super(
			'BAD_REQUEST',
			'CRITICAL_REVIEW_NOTE_REQUIRED',
			'A critical result needs your note of what you did about it.',
		);
	}
}

/** Someone moved the test on meanwhile (another tab, another medtech). */
export class DiagnosticItemChangedError extends DomainError {
	constructor() {
		super('CONFLICT', 'DIAGNOSTIC_ITEM_CHANGED', 'Someone else updated this test just now. Reload and try again.');
	}
}
