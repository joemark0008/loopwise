import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
	IsDateString,
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Matches,
	Max,
	MaxLength,
	Min,
	MinLength,
	ValidateNested,
} from 'class-validator';

import { WiseOriginInput } from '../../../wise-proposals/dto/wise-origin.input.js';
import { AppointmentStatus, BookingChannel, VisitType } from '../../scheduling.enums.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

@InputType({ description: "A clinic's appointments over one or more days (the day and week views)." })
export class ClinicAppointmentsInput {
	@Field(() => ID)
	@IsUUID()
	clinicId: string;

	@Field({ description: 'The first day, YYYY-MM-DD (Manila).' })
	@Matches(DATE)
	from: string;

	@Field(() => Int, { nullable: true, description: 'How many days, 1 (default) to 7 (a week).' })
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(7)
	days?: number | null;

	@Field(() => ID, { nullable: true, description: "One doctor's appointments." })
	@IsOptional()
	@IsUUID()
	practitionerId?: string | null;

	@Field(() => [AppointmentStatus], { nullable: true, description: 'Default: every status.' })
	@IsOptional()
	@IsIn(Object.values(AppointmentStatus), { each: true })
	statuses?: AppointmentStatus[] | null;
}

@InputType({ description: "A doctor's slots at a clinic on a day." })
export class AppointmentSlotsInput {
	@Field(() => ID)
	@IsUUID()
	clinicId: string;

	@Field(() => ID)
	@IsUUID()
	practitionerId: string;

	@Field({ description: 'YYYY-MM-DD (Manila).' })
	@Matches(DATE)
	date: string;
}

@InputType()
export class BookAppointmentInput {
	@Field(() => ID)
	@IsUUID()
	clinicId: string;

	@Field(() => ID)
	@IsUUID()
	patientId: string;

	@Field(() => ID)
	@IsUUID()
	practitionerId: string;

	@Field({ description: "ISO 8601: the start of one of the doctor's open slots (`appointmentSlots`)." })
	@IsDateString()
	scheduledStart: string;

	@Field(() => VisitType, { nullable: true, description: 'Default NEW_PATIENT.' })
	@IsOptional()
	@IsIn(Object.values(VisitType))
	visitType?: VisitType | null;

	@Field(() => BookingChannel, { nullable: true, description: 'How the patient booked; default PHONE.' })
	@IsOptional()
	@IsIn(Object.values(BookingChannel))
	channel?: BookingChannel | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(400)
	reason?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(2000)
	notes?: string | null;

	@Field(() => WiseOriginInput, { nullable: true, description: 'Set by the Wise card (`propose_appointment`).' })
	@IsOptional()
	@ValidateNested()
	@Type(() => WiseOriginInput)
	wiseOrigin?: WiseOriginInput | null;
}

@InputType({ description: 'Moves a booking to another slot: the old one becomes RESCHEDULED, a new one points at it.' })
export class RescheduleAppointmentInput {
	@Field(() => ID)
	@IsUUID()
	appointmentId: string;

	@Field({ description: 'ISO 8601: the new slot.' })
	@IsDateString()
	scheduledStart: string;

	@Field(() => ID, { nullable: true, description: 'Another doctor; default the same.' })
	@IsOptional()
	@IsUUID()
	practitionerId?: string | null;

	@Field(() => String, { nullable: true, description: 'Why (e.g. the doctor is out).' })
	@IsOptional()
	@IsString()
	@MaxLength(300)
	reason?: string | null;

	@Field(() => WiseOriginInput, { nullable: true, description: 'Set by the Wise card (`propose_reschedule`).' })
	@IsOptional()
	@ValidateNested()
	@Type(() => WiseOriginInput)
	wiseOrigin?: WiseOriginInput | null;
}

@InputType()
export class CancelAppointmentInput {
	@Field(() => ID)
	@IsUUID()
	appointmentId: string;

	@Field({ description: 'Why the booking is cancelled.' })
	@IsString()
	@MinLength(1)
	@MaxLength(300)
	reason: string;
}
