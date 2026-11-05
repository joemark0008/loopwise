import { Field, Float, ID, InputType, Int } from '@nestjs/graphql';
import {
	IsBoolean,
	IsEmail,
	IsIn,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	IsUrl,
	IsUUID,
	Matches,
	Max,
	MaxLength,
	Min,
	MinLength,
} from 'class-validator';

import { Sex } from '../../../patients/patients.enums.js';
import { PractitionerType } from '../../practitioners.enums.js';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * A practitioner's profile as a clinic admin keeps it: the credentials of the own profile (Settings → Account), plus
 * the user who signs in as them, contact, TIN and e-signature. Without `id` a new practitioner is created and linked to
 * the selected clinic.
 */
@InputType()
export class SavePractitionerInput {
	@Field(() => ID, { nullable: true, description: 'The practitioner to update; empty to add one.' })
	@IsOptional()
	@IsUUID()
	id?: string | null;

	@Field(() => ID, { nullable: true, description: 'The user who signs in as this practitioner (none: visiting).' })
	@IsOptional()
	@IsUUID()
	userId?: string | null;

	@Field(() => PractitionerType, { nullable: true, description: 'Default PHYSICIAN.' })
	@IsOptional()
	@IsIn(Object.values(PractitionerType))
	type?: PractitionerType | null;

	@Field(() => String, { nullable: true, description: '"Dr.", "Dra."' })
	@IsOptional()
	@IsString()
	@MaxLength(20)
	title?: string | null;

	@Field()
	@IsString()
	@MinLength(1)
	@MaxLength(100)
	firstName: string;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(100)
	middleName?: string | null;

	@Field()
	@IsString()
	@MinLength(1)
	@MaxLength(100)
	lastName: string;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(20)
	suffix?: string | null;

	@Field(() => String, { nullable: true, description: 'e.g. "MD, FPCP".' })
	@IsOptional()
	@IsString()
	@MaxLength(60)
	postNominals?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(120)
	specialty?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(120)
	subspecialty?: string | null;

	@Field({ description: 'PRC license number (required, unique).' })
	@IsString()
	@MinLength(4)
	@MaxLength(20)
	prcLicenseNo: string;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD.' })
	@IsOptional()
	@Matches(DATE_ONLY)
	prcLicenseExpiry?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(40)
	ptrNo?: string | null;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD.' })
	@IsOptional()
	@Matches(DATE_ONLY)
	ptrIssuedDate?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(120)
	ptrIssuedAt?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(40)
	s2LicenseNo?: string | null;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD.' })
	@IsOptional()
	@Matches(DATE_ONLY)
	s2LicenseExpiry?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(40)
	philhealthPan?: string | null;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD.' })
	@IsOptional()
	@Matches(DATE_ONLY)
	philhealthPanExpiry?: string | null;

	@Field(() => Sex, { nullable: true })
	@IsOptional()
	@IsIn(Object.values(Sex))
	sex?: Sex | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(30)
	mobileNo?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsEmail()
	@MaxLength(160)
	email?: string | null;

	@Field(() => String, { nullable: true, description: 'TIN, for the withholding tax on professional fees.' })
	@IsOptional()
	@Matches(/^\d{3}-?\d{3}-?\d{3}(-?\d{3,5})?$/, { message: 'TIN is 9 digits plus an optional branch code.' })
	tin?: string | null;

	@Field(() => String, { nullable: true, description: 'https URL of the e-signature image.' })
	@IsOptional()
	@IsUrl({ require_protocol: true, protocols: ['https', 'http'] })
	@MaxLength(500)
	signatureUrl?: string | null;

	@Field(() => Boolean, { nullable: true, description: 'Default true.' })
	@IsOptional()
	@IsBoolean()
	isActive?: boolean | null;
}

/** The practitioner's room and fee at the selected clinic, and whether they hold clinic there now. */
@InputType()
export class SetPractitionerClinicInput {
	@Field(() => ID)
	@IsUUID()
	practitionerId: string;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(60)
	roomName?: string | null;

	@Field(() => Float, { nullable: true, description: 'Pesos.' })
	@IsOptional()
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	@Max(1_000_000)
	consultFee?: number | null;

	@Field()
	@IsBoolean()
	isActive: boolean;
}

/** A weekly session at the selected clinic, e.g. Mondays 09:00–12:00 in 15-minute slots. */
@InputType()
export class PractitionerScheduleInput {
	@Field(() => ID, { nullable: true, description: 'The session to change; empty to add one.' })
	@IsOptional()
	@IsUUID()
	id?: string | null;

	@Field(() => ID)
	@IsUUID()
	practitionerId: string;

	@Field(() => Int, { description: '0 = Sunday … 6 = Saturday.' })
	@IsInt()
	@Min(0)
	@Max(6)
	dayOfWeek: number;

	@Field({ description: 'HH:MM, Philippine time.' })
	@Matches(TIME, { message: 'Times are HH:MM.' })
	startTime: string;

	@Field({ description: 'HH:MM, Philippine time.' })
	@Matches(TIME, { message: 'Times are HH:MM.' })
	endTime: string;

	@Field(() => Int, { description: '5–240 minutes.' })
	@IsInt()
	@Min(5)
	@Max(240)
	slotMinutes: number;

	@Field(() => Int, { nullable: true, description: 'Cap of patients for the session; empty for none.' })
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(500)
	maxPatients?: number | null;
}

/** A leave: whole days from `startDate` to `endDate` (inclusive), or part of one day with times. */
@InputType()
export class AddPractitionerLeaveInput {
	@Field(() => ID)
	@IsUUID()
	practitionerId: string;

	@Field({ description: 'YYYY-MM-DD.' })
	@Matches(DATE_ONLY)
	startDate: string;

	@Field({ description: 'YYYY-MM-DD, inclusive.' })
	@Matches(DATE_ONLY)
	endDate: string;

	@Field(() => String, { nullable: true, description: 'HH:MM on the start date; empty for the whole day.' })
	@IsOptional()
	@Matches(TIME)
	startTime?: string | null;

	@Field(() => String, { nullable: true, description: 'HH:MM on the end date; empty for the whole day.' })
	@IsOptional()
	@Matches(TIME)
	endTime?: string | null;

	@Field(() => String, { nullable: true, description: 'Conference, holiday, sick …' })
	@IsOptional()
	@IsString()
	@MaxLength(200)
	reason?: string | null;
}
