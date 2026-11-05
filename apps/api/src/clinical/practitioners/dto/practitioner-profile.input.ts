import { Field, InputType } from '@nestjs/graphql';
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { PractitionerType } from '../practitioners.enums.js';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The signed-in user's own practitioner profile. The PRC license number is required (it is printed on every
 * prescription and certificate) and unique; names default to the user's.
 */
@InputType()
export class SaveMyPractitionerInput {
	@Field(() => PractitionerType, { nullable: true, description: 'Default PHYSICIAN.' })
	@IsOptional()
	@IsIn(Object.values(PractitionerType))
	type?: PractitionerType | null;

	@Field(() => String, { nullable: true, description: '"Dr.", "Dra."' })
	@IsOptional()
	@IsString()
	@MaxLength(20)
	title?: string | null;

	@Field(() => String, { nullable: true, description: "Default: the user's first name." })
	@IsOptional()
	@IsString()
	@MaxLength(100)
	firstName?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(100)
	middleName?: string | null;

	@Field(() => String, { nullable: true, description: "Default: the user's last name." })
	@IsOptional()
	@IsString()
	@MaxLength(100)
	lastName?: string | null;

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

	@Field(() => String, { nullable: true, description: 'Professional tax receipt number.' })
	@IsOptional()
	@IsString()
	@MaxLength(40)
	ptrNo?: string | null;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD.' })
	@IsOptional()
	@Matches(DATE_ONLY)
	ptrIssuedDate?: string | null;

	@Field(() => String, { nullable: true, description: 'The LGU that issued the PTR, e.g. "Tagbilaran City".' })
	@IsOptional()
	@IsString()
	@MaxLength(120)
	ptrIssuedAt?: string | null;

	@Field(() => String, { nullable: true, description: 'PDEA S2 license number (dangerous drugs, RA 9165).' })
	@IsOptional()
	@IsString()
	@MaxLength(40)
	s2LicenseNo?: string | null;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD.' })
	@IsOptional()
	@Matches(DATE_ONLY)
	s2LicenseExpiry?: string | null;

	@Field(() => String, { nullable: true, description: 'PhilHealth accreditation number (PAN).' })
	@IsOptional()
	@IsString()
	@MaxLength(40)
	philhealthPan?: string | null;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD.' })
	@IsOptional()
	@Matches(DATE_ONLY)
	philhealthPanExpiry?: string | null;
}
