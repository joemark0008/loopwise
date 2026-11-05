import { registerEnumType } from '@nestjs/graphql';

import {
	AppointmentStatus,
	BookingChannel,
	PriorityReason,
	QueueStatus,
	VisitType,
} from '../../generated/prisma/enums.js';

/**
 * Where a queue ticket waits (`queue_tickets.station`): the nurse's triage, its doctor's room (the ticket's
 * `practitioner_id`), or the cashier. Stored as the code; the board shows `stationLabel`.
 */
export const QueueStation = {
	TRIAGE: 'TRIAGE',
	DOCTOR: 'DOCTOR',
	CASHIER: 'CASHIER',
} as const;
export type QueueStation = (typeof QueueStation)[keyof typeof QueueStation];

/** Why a slot can't be booked, or OPEN. */
export const SlotStatus = {
	OPEN: 'OPEN',
	BOOKED: 'BOOKED',
	FULL: 'FULL',
	ON_LEAVE: 'ON_LEAVE',
	PAST: 'PAST',
} as const;
export type SlotStatus = (typeof SlotStatus)[keyof typeof SlotStatus];

registerEnumType(AppointmentStatus, {
	name: 'AppointmentStatus',
	description:
		'SCHEDULED → CONFIRMED → ARRIVED (checked in) → IN_PROGRESS (with the doctor) → COMPLETED; or CANCELLED, ' +
		'NO_SHOW, RESCHEDULED (a new appointment points back at it).',
});
registerEnumType(BookingChannel, { name: 'BookingChannel' });
registerEnumType(VisitType, { name: 'VisitType' });
registerEnumType(QueueStatus, {
	name: 'QueueStatus',
	description: 'WAITING → CALLED → SERVING → DONE; or SKIPPED (not there when called), CANCELLED.',
});
registerEnumType(PriorityReason, {
	name: 'PriorityReason',
	description: 'The priority lane (RA 9994 seniors, RA 7277 / RA 10754 PWDs, pregnant, with an infant, emergency).',
});
registerEnumType(QueueStation, { name: 'QueueStation' });
registerEnumType(SlotStatus, { name: 'SlotStatus' });

export { AppointmentStatus, BookingChannel, PriorityReason, QueueStatus, VisitType };
