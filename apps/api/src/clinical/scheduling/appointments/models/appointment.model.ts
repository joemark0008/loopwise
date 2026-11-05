import { Field, ID, ObjectType } from '@nestjs/graphql';

import { EncounterStatus } from '../../../encounters/encounters.enums.js';
import { toDateOnly } from '../../../patients/parse-input.js';
import { practitionerDisplayName } from '../../../practitioners/models/practitioner.model.js';
import { AppointmentStatus, BookingChannel, SlotStatus, VisitType } from '../../scheduling.enums.js';
import type { AppointmentRow, PractitionerAtClinic } from '../appointment.repository.js';

@ObjectType({ description: 'The patient of an appointment or queue ticket, as the front desk shows them.' })
export class SchedulingPatient {
	@Field(() => ID)
	id: string;

	@Field({ description: 'First and last name.' })
	name: string;

	@Field()
	patientNo: string;

	@Field({ description: 'YYYY-MM-DD.' })
	birthDate: string;

	@Field()
	sex: string;

	@Field(() => String, { nullable: true })
	mobileNo: string | null;
}

@ObjectType({ description: 'The doctor of an appointment or a queue line, with their room at the clinic.' })
export class SchedulingPractitioner {
	@Field(() => ID)
	id: string;

	@Field({ description: 'As printed: "Dra. Ana Reyes, MD".' })
	name: string;

	@Field({ description: 'For the board: "Dra. Reyes".' })
	shortName: string;

	@Field(() => String, { nullable: true, description: 'Their room at this clinic, e.g. "Room 1".' })
	roomName: string | null;

	@Field(() => ID, { nullable: true })
	userId: string | null;
}

@ObjectType({ description: 'The visit an appointment became at check-in.' })
export class AppointmentEncounter {
	@Field(() => ID)
	id: string;

	@Field()
	encounterNo: string;

	@Field(() => EncounterStatus)
	status: EncounterStatus;
}

@ObjectType({ description: 'A booking with a doctor at a clinic (DESIGN.md §5.2 scheduling); 1:1 with its visit.' })
export class Appointment {
	@Field(() => ID)
	id: string;

	@Field(() => ID)
	clinicId: string;

	@Field(() => ID)
	patientId: string;

	@Field(() => ID)
	practitionerId: string;

	@Field()
	scheduledStart: Date;

	@Field(() => Date, { nullable: true })
	scheduledEnd: Date | null;

	@Field(() => VisitType)
	visitType: VisitType;

	@Field(() => BookingChannel)
	channel: BookingChannel;

	@Field(() => AppointmentStatus)
	status: AppointmentStatus;

	@Field(() => String, { nullable: true, description: 'Why the patient is coming, in their words.' })
	reason: string | null;

	@Field(() => String, { nullable: true })
	notes: string | null;

	@Field(() => Date, { nullable: true })
	reminderSentAt: Date | null;

	@Field(() => String, { nullable: true })
	cancelledReason: string | null;

	@Field(() => ID, { nullable: true, description: 'The appointment this one replaced (rescheduled).' })
	rescheduledFrom: string | null;

	@Field()
	createdAt: Date;

	@Field(() => SchedulingPatient)
	patient: SchedulingPatient;

	@Field(() => SchedulingPractitioner)
	practitioner: SchedulingPractitioner;

	@Field(() => AppointmentEncounter, { nullable: true, description: 'Set once the patient is checked in.' })
	encounter: AppointmentEncounter | null;
}

@ObjectType({ description: "One of a doctor's slots on a day, and whether it can be booked." })
export class AppointmentSlot {
	@Field()
	start: Date;

	@Field()
	end: Date;

	@Field(() => SlotStatus)
	status: SlotStatus;
}

export function personName(person: { firstName: string; lastName: string }): string {
	return `${person.firstName} ${person.lastName}`;
}

export function toSchedulingPatient(row: AppointmentRow['patient']): SchedulingPatient {
	return {
		id: row.id,
		name: personName(row),
		patientNo: row.patientNo,
		birthDate: toDateOnly(row.birthDate),
		sex: row.sex,
		mobileNo: row.mobileNo,
	};
}

export function toSchedulingPractitioner(row: PractitionerAtClinic, clinicId: string): SchedulingPractitioner {
	return {
		id: row.id,
		name: practitionerDisplayName(row),
		shortName: [row.title, row.lastName].filter(Boolean).join(' '),
		roomName: row.clinics.find((clinic) => clinic.clinicId === clinicId)?.roomName ?? null,
		userId: row.userId,
	};
}

export function toAppointment(row: AppointmentRow): Appointment {
	return {
		id: row.id,
		clinicId: row.clinicId,
		patientId: row.patientId,
		practitionerId: row.practitionerId,
		scheduledStart: row.scheduledStart,
		scheduledEnd: row.scheduledEnd,
		visitType: row.visitType,
		channel: row.channel,
		status: row.status,
		reason: row.reason,
		notes: row.notes,
		reminderSentAt: row.reminderSentAt,
		cancelledReason: row.cancelledReason,
		rescheduledFrom: row.rescheduledFrom,
		createdAt: row.createdAt,
		patient: toSchedulingPatient(row.patient),
		practitioner: toSchedulingPractitioner(row.practitioner, row.clinicId),
		encounter: row.encounter,
	};
}
