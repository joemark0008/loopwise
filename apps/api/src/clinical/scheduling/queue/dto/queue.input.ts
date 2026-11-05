import { Field, ID, InputType } from '@nestjs/graphql';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

import { PriorityReason, QueueStation, QueueStatus, VisitType } from '../../scheduling.enums.js';

@InputType({ description: "A clinic's queue on a day: every line, one station, or one doctor's line." })
export class QueueTicketsInput {
	@Field(() => ID)
	@IsUUID()
	clinicId: string;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD (Manila); default today.' })
	@IsOptional()
	@Matches(/^\d{4}-\d{2}-\d{2}$/)
	date?: string | null;

	@Field(() => QueueStation, { nullable: true })
	@IsOptional()
	@IsIn(Object.values(QueueStation))
	station?: QueueStation | null;

	@Field(() => ID, { nullable: true, description: "One doctor's line." })
	@IsOptional()
	@IsUUID()
	practitionerId?: string | null;

	@Field({ nullable: true, description: "Your own line as a doctor (the doctor's room, your practitioner)." })
	@IsOptional()
	@IsBoolean()
	mine?: boolean;

	@Field(() => [QueueStatus], { nullable: true, description: 'Default: every status.' })
	@IsOptional()
	@IsIn(Object.values(QueueStatus), { each: true })
	statuses?: QueueStatus[] | null;
}

@InputType({
	description:
		"Checks a patient in: today's booking (`appointmentId`), or a walk-in (`patientId` and the doctor whose line " +
		'they join). Opens the visit and issues the queue number in one transaction.',
})
export class CheckInPatientInput {
	@Field(() => ID)
	@IsUUID()
	clinicId: string;

	@Field(() => ID, { nullable: true, description: "Today's booking." })
	@IsOptional()
	@IsUUID()
	appointmentId?: string | null;

	@Field(() => ID, { nullable: true, description: 'A walk-in: the patient (registered first).' })
	@IsOptional()
	@IsUUID()
	patientId?: string | null;

	@Field(() => ID, { nullable: true, description: 'A walk-in: the doctor whose line they join.' })
	@IsOptional()
	@IsUUID()
	practitionerId?: string | null;

	@Field(() => VisitType, { nullable: true, description: 'A walk-in: default NEW_PATIENT.' })
	@IsOptional()
	@IsIn(Object.values(VisitType))
	visitType?: VisitType | null;

	@Field(() => String, { nullable: true, description: 'Why they came (the starting chief complaint).' })
	@IsOptional()
	@IsString()
	@MaxLength(400)
	reason?: string | null;

	@Field(() => PriorityReason, {
		nullable: true,
		description: 'The priority lane "P" (senior, PWD, pregnant, with an infant, emergency); else lane "A".',
	})
	@IsOptional()
	@IsIn(Object.values(PriorityReason))
	priorityReason?: PriorityReason | null;

	@Field(() => QueueStation, { nullable: true, description: 'TRIAGE (default) or straight to the DOCTOR.' })
	@IsOptional()
	@IsIn([QueueStation.TRIAGE, QueueStation.DOCTOR])
	station?: QueueStation | null;
}

@InputType({ description: 'Calls the next patient at a station: the priority lane first, then by arrival.' })
export class CallNextInput {
	@Field(() => ID)
	@IsUUID()
	clinicId: string;

	@Field(() => QueueStation)
	@IsIn(Object.values(QueueStation))
	station: QueueStation;

	@Field(() => ID, { nullable: true, description: "DOCTOR: the doctor's line; default your own." })
	@IsOptional()
	@IsUUID()
	practitionerId?: string | null;
}

@InputType({ description: 'Sends a patient being served to the next station, keeping their number.' })
export class SendQueueTicketInput {
	@Field(() => ID)
	@IsUUID()
	ticketId: string;

	@Field(() => QueueStation)
	@IsIn([QueueStation.DOCTOR, QueueStation.CASHIER])
	station: QueueStation;
}

@InputType()
export class CancelQueueTicketInput {
	@Field(() => ID)
	@IsUUID()
	ticketId: string;

	@Field({ description: 'Why (e.g. left before being seen).' })
	@IsString()
	@MinLength(1)
	@MaxLength(300)
	reason: string;
}
