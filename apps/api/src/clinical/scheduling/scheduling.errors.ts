import { DomainError } from '../../common/errors/domain-error.js';

/** The user doesn't work this desk at the clinic (front desk, triage, the doctor's line, the cashier). */
export class SchedulingDeskAccessError extends DomainError {
	constructor(desk: string) {
		super('FORBIDDEN', 'SCHEDULING_DESK_ACCESS', `Only the ${desk} of the clinic can do this.`, { desk });
	}
}

/** The time asked for is not one of the doctor's slots at the clinic that day. */
export class SlotNotInScheduleError extends DomainError {
	constructor() {
		super('CONFLICT', 'SLOT_NOT_IN_SCHEDULE', "That time isn't one of the doctor's slots at this clinic.");
	}
}

/** The slot is booked already, the session is at its `max_patients`, the doctor is on leave, or it is past. */
export class SlotUnavailableError extends DomainError {
	constructor(reason: 'BOOKED' | 'FULL' | 'ON_LEAVE' | 'PAST') {
		const message = {
			BOOKED: 'That slot is already booked. Pick another time.',
			FULL: "The doctor's session is full that day.",
			ON_LEAVE: 'The doctor is on leave then.',
			PAST: 'That time has passed.',
		}[reason];
		super('CONFLICT', 'SLOT_UNAVAILABLE', message, { reason });
	}
}

/** The practitioner doesn't hold clinic at this clinic. */
export class PractitionerNotAtClinicError extends DomainError {
	constructor() {
		super('BAD_REQUEST', 'PRACTITIONER_NOT_AT_CLINIC', "The doctor doesn't hold clinic here.");
	}
}

/** A cancellation needs its reason. */
export class CancelReasonRequiredError extends DomainError {
	constructor() {
		super('BAD_REQUEST', 'CANCEL_REASON_REQUIRED', 'Give the reason for the cancellation.');
	}
}

/** A no-show is marked once the booked time has passed. */
export class NoShowTooEarlyError extends DomainError {
	constructor() {
		super('CONFLICT', 'NO_SHOW_TOO_EARLY', "The appointment time hasn't come yet.");
	}
}

/** Check-in names a booked appointment, or a walk-in patient with the doctor whose line they join. */
export class InvalidCheckInError extends DomainError {
	constructor(message: string) {
		super('BAD_REQUEST', 'INVALID_CHECK_IN', message);
	}
}

/** Only today's appointments are checked in. */
export class AppointmentNotTodayError extends DomainError {
	constructor() {
		super('CONFLICT', 'APPOINTMENT_NOT_TODAY', "Only today's appointments can be checked in.");
	}
}

/** The visit is already open: the patient was checked in before. */
export class AlreadyCheckedInError extends DomainError {
	constructor() {
		super('CONFLICT', 'ALREADY_CHECKED_IN', 'The patient is already checked in for this appointment.');
	}
}

/** The station doesn't take this move (e.g. the doctor's room needs its doctor). */
export class InvalidQueueStationError extends DomainError {
	constructor(message: string) {
		super('BAD_REQUEST', 'INVALID_QUEUE_STATION', message);
	}
}

/** Another desk moved the ticket first (called, skipped, sent on): reload the queue. */
export class QueueTicketMovedError extends DomainError {
	constructor() {
		super('CONFLICT', 'QUEUE_TICKET_MOVED', 'Someone else moved this patient in the queue. Reload and try again.');
	}
}

/** A visit can only be cancelled from the queue before the doctor starts it. */
export class VisitAlreadyStartedError extends DomainError {
	constructor() {
		super('CONFLICT', 'VISIT_ALREADY_STARTED', 'The doctor has started this visit; finish it instead.');
	}
}

/** The doctor's line belongs to its doctor: another doctor doesn't call or start it. */
export class NotYourQueueLineError extends DomainError {
	constructor() {
		super('FORBIDDEN', 'NOT_YOUR_QUEUE_LINE', "This patient is in another doctor's line.");
	}
}
