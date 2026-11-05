import { InvalidStatusTransitionError } from '../../../common/errors/domain-error.js';
import type { AppointmentStatus } from '../../../generated/prisma/enums.js';

/**
 * The appointment's status machine (`appointment_status`):
 *
 * ```
 * SCHEDULED ──► CONFIRMED ──► ARRIVED ──► IN_PROGRESS ──► COMPLETED
 *     │             │            │             (check-in opens the visit; the doctor starts it)
 *     └─────────────┴────────────┴──► CANCELLED (with a reason)
 *     └─────────────┴──► NO_SHOW, RESCHEDULED (a new appointment keeps `rescheduled_from`)
 * ARRIVED ──► COMPLETED (the visit ended without the doctor's start, e.g. lab only)
 * ```
 *
 * COMPLETED, CANCELLED, NO_SHOW and RESCHEDULED are final. Statuses are only written through `transitionAppointment`.
 */
export const APPOINTMENT_TRANSITIONS: Readonly<Record<AppointmentStatus, readonly AppointmentStatus[]>> = {
	SCHEDULED: ['CONFIRMED', 'ARRIVED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'],
	CONFIRMED: ['ARRIVED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'],
	ARRIVED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
	IN_PROGRESS: ['COMPLETED'],
	COMPLETED: [],
	CANCELLED: [],
	NO_SHOW: [],
	RESCHEDULED: [],
};

/** Bookings that still hold their slot (count against the session's `max_patients`). */
export const ACTIVE_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
	'SCHEDULED',
	'CONFIRMED',
	'ARRIVED',
	'IN_PROGRESS',
	'COMPLETED',
];

/** Bookings the front desk can still change (reschedule, cancel, mark no-show, check in). */
export const UPCOMING_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = ['SCHEDULED', 'CONFIRMED'];

export function canTransitionAppointment(from: AppointmentStatus, to: AppointmentStatus): boolean {
	return APPOINTMENT_TRANSITIONS[from].includes(to);
}

/** The new status, or INVALID_STATUS_TRANSITION when the machine forbids the move (including staying put). */
export function transitionAppointment(from: AppointmentStatus, to: AppointmentStatus): { status: AppointmentStatus } {
	if (!canTransitionAppointment(from, to)) {
		throw new InvalidStatusTransitionError('Appointment', from, to);
	}
	return { status: to };
}
