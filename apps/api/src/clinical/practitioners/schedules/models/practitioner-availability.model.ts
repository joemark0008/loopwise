import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

import type { PractitionerLeave as PractitionerLeaveRow } from '../../../../generated/prisma/client.js';
import type { DaySession, LeaveWindow } from '../availability.js';

@ObjectType({ description: 'A leave of a practitioner (conference, holiday, sick): no bookings in it.' })
export class PractitionerLeave {
	@Field(() => ID)
	id: string;

	@Field(() => ID)
	practitionerId: string;

	@Field()
	startAt: Date;

	@Field()
	endAt: Date;

	@Field(() => String, { nullable: true })
	reason: string | null;
}

@ObjectType({ description: 'A bookable slot.' })
export class AvailabilitySlot {
	@Field()
	startsAt: Date;

	@Field()
	endsAt: Date;
}

@ObjectType({ description: 'A weekly session on the date asked for, with the slots a leave leaves free.' })
export class AvailabilitySession {
	@Field(() => ID, { description: 'The `practitioner_schedules` row.' })
	scheduleId: string;

	@Field({ description: 'HH:MM, Philippine time.' })
	startTime: string;

	@Field({ description: 'HH:MM, Philippine time.' })
	endTime: string;

	@Field()
	startsAt: Date;

	@Field()
	endsAt: Date;

	@Field(() => Int)
	slotMinutes: number;

	@Field(() => Int, { nullable: true, description: 'Cap of patients for the session; null = no cap.' })
	maxPatients: number | null;

	@Field({ description: 'A leave overlaps the session.' })
	onLeave: boolean;

	@Field(() => [AvailabilitySlot])
	slots: AvailabilitySlot[];
}

@ObjectType({
	description: "A practitioner's day at a clinic: weekly sessions of that day of week, cut into slots, minus leaves.",
})
export class PractitionerAvailability {
	@Field(() => ID)
	practitionerId: string;

	@Field(() => ID)
	clinicId: string;

	@Field({ description: 'YYYY-MM-DD (Philippine calendar date).' })
	date: string;

	@Field(() => Int, { description: '0 = Sunday … 6 = Saturday.' })
	dayOfWeek: number;

	@Field({ description: 'The practitioner holds clinic here (an active link to the clinic, an active profile).' })
	practicesHere: boolean;

	@Field({ description: 'A leave overlaps the day.' })
	onLeave: boolean;

	@Field(() => [PractitionerLeave], { description: 'The leaves that overlap the day.' })
	leaves: PractitionerLeave[];

	@Field(() => [AvailabilitySession])
	sessions: AvailabilitySession[];
}

export function toPractitionerLeave(row: PractitionerLeaveRow): PractitionerLeave {
	return {
		id: row.id,
		practitionerId: row.practitionerId,
		startAt: row.startAt,
		endAt: row.endAt,
		reason: row.reason,
	};
}

export function toAvailabilitySession(session: DaySession): AvailabilitySession {
	return {
		scheduleId: session.id,
		startTime: session.startTime,
		endTime: session.endTime,
		startsAt: session.startsAt,
		endsAt: session.endsAt,
		slotMinutes: session.slotMinutes,
		maxPatients: session.maxPatients,
		onLeave: session.onLeave,
		slots: session.slots,
	};
}

export function toLeaveWindow(row: PractitionerLeaveRow): LeaveWindow {
	return { id: row.id, startAt: row.startAt, endAt: row.endAt, reason: row.reason };
}
