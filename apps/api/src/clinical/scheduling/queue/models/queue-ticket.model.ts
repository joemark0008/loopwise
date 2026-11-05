import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

import { EncounterStatus } from '../../../encounters/encounters.enums.js';
import { toDateOnly } from '../../../patients/parse-input.js';
import {
	SchedulingPatient,
	SchedulingPractitioner,
	toSchedulingPatient,
	toSchedulingPractitioner,
} from '../../appointments/models/appointment.model.js';
import { AppointmentStatus, PriorityReason, QueueStation, QueueStatus, VisitType } from '../../scheduling.enums.js';
import type { BoardTicketRow, QueueTicketRow } from '../queue.repository.js';
import { ticketCode } from '../queue-status.js';

@ObjectType({ description: 'The visit a ticket was checked in for.' })
export class QueueTicketEncounter {
	@Field(() => ID)
	id: string;

	@Field()
	encounterNo: string;

	@Field(() => EncounterStatus)
	status: EncounterStatus;

	@Field(() => String, { nullable: true, description: 'The chief complaint so far.' })
	reason: string | null;

	@Field(() => Int, { description: "The visit's version (for `updateEncounterNote`'s expectedVersion)." })
	version: number;
}

@ObjectType({ description: 'The booking behind a ticket (a walk-in has one too, channel WALK_IN).' })
export class QueueTicketAppointment {
	@Field(() => ID)
	id: string;

	@Field(() => AppointmentStatus)
	status: AppointmentStatus;

	@Field()
	scheduledStart: Date;

	@Field(() => VisitType)
	visitType: VisitType;
}

@ObjectType({ description: "A patient's queue number for the day at a clinic; it follows them station to station." })
export class QueueTicket {
	@Field(() => ID)
	id: string;

	@Field(() => ID)
	clinicId: string;

	@Field({ description: 'YYYY-MM-DD.' })
	queueDate: string;

	@Field({ description: 'As called: "A-007", "P-002".' })
	code: string;

	@Field({ description: '"A" regular lane, "P" priority lane.' })
	prefix: string;

	@Field(() => Int)
	number: number;

	@Field()
	isPriority: boolean;

	@Field(() => PriorityReason, { nullable: true })
	priorityReason: PriorityReason | null;

	@Field(() => QueueStation)
	station: QueueStation;

	@Field({ description: 'For the board: "Triage", "Dra. Reyes · Room 1", "Cashier".' })
	stationLabel: string;

	@Field(() => QueueStatus)
	status: QueueStatus;

	@Field()
	issuedAt: Date;

	@Field(() => Date, { nullable: true })
	calledAt: Date | null;

	@Field(() => Date, { nullable: true })
	servedAt: Date | null;

	@Field(() => Date, { nullable: true })
	doneAt: Date | null;

	@Field(() => SchedulingPractitioner, { nullable: true, description: 'The doctor whose line the patient joins.' })
	practitioner: SchedulingPractitioner | null;

	@Field(() => QueueTicketEncounter, { nullable: true, description: 'Null when you may not see the visit.' })
	encounter: QueueTicketEncounter | null;

	@Field(() => SchedulingPatient, { nullable: true, description: 'Null when you may not see the patient.' })
	patient: SchedulingPatient | null;

	@Field(() => QueueTicketAppointment, { nullable: true })
	appointment: QueueTicketAppointment | null;
}

@ObjectType({ description: 'A number on the waiting-room board: no names, no reasons.' })
export class BoardTicket {
	@Field(() => ID)
	id: string;

	@Field()
	code: string;

	@Field()
	isPriority: boolean;

	@Field(() => QueueStatus)
	status: QueueStatus;

	@Field(() => QueueStation)
	station: QueueStation;

	@Field()
	stationLabel: string;

	@Field(() => Date, { nullable: true })
	calledAt: Date | null;
}

@ObjectType({ description: 'The waiting-room board of a clinic today.' })
export class QueueBoard {
	@Field()
	clinicName: string;

	@Field({ description: 'YYYY-MM-DD (Manila).' })
	date: string;

	@Field(() => [BoardTicket], { description: 'Called or being served, latest call first.' })
	nowServing: BoardTicket[];

	@Field(() => [BoardTicket], { description: 'Waiting, in call order (priority lane first).' })
	waiting: BoardTicket[];
}

/** "Triage", "Dra. Reyes · Room 1", "Cashier". */
export function stationLabel(
	station: string | null,
	practitioner: Parameters<typeof toSchedulingPractitioner>[0] | null,
	clinicId: string,
): string {
	if (station === QueueStation.DOCTOR && practitioner) {
		const doctor = toSchedulingPractitioner(practitioner, clinicId);
		return [doctor.shortName, doctor.roomName].filter(Boolean).join(' · ');
	}
	return station === QueueStation.CASHIER ? 'Cashier' : station === QueueStation.DOCTOR ? 'Doctor' : 'Triage';
}

export function toQueueStation(station: string | null): QueueStation {
	return station === QueueStation.DOCTOR || station === QueueStation.CASHIER ? station : QueueStation.TRIAGE;
}

export function toQueueTicket(row: QueueTicketRow): QueueTicket {
	const encounter = row.encounter;
	return {
		id: row.id,
		clinicId: row.clinicId,
		queueDate: toDateOnly(row.queueDate),
		code: ticketCode(row),
		prefix: row.prefix,
		number: row.number,
		isPriority: row.isPriority,
		priorityReason: row.priorityReason,
		station: toQueueStation(row.station),
		stationLabel: stationLabel(row.station, row.practitioner, row.clinicId),
		status: row.status,
		issuedAt: row.issuedAt,
		calledAt: row.calledAt,
		servedAt: row.servedAt,
		doneAt: row.doneAt,
		practitioner: row.practitioner && toSchedulingPractitioner(row.practitioner, row.clinicId),
		encounter: encounter && {
			id: encounter.id,
			encounterNo: encounter.encounterNo,
			status: encounter.status,
			reason: encounter.chiefComplaint,
			version: encounter.version,
		},
		patient: encounter && toSchedulingPatient(encounter.patient),
		appointment: encounter?.appointment ?? null,
	};
}

export function toBoardTicket(row: BoardTicketRow, clinicId: string): BoardTicket {
	return {
		id: row.id,
		code: ticketCode(row),
		isPriority: row.isPriority,
		status: row.status,
		station: toQueueStation(row.station),
		stationLabel: stationLabel(row.station, row.practitioner, clinicId),
		calledAt: row.calledAt,
	};
}
