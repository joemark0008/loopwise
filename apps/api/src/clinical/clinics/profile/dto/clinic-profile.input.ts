import { Field, InputType } from '@nestjs/graphql';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';

import { VatRegistration } from '../models/clinic-profile.model.js';

export const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
/** BIR TIN: 9 digits, plus a 3–5 digit branch code; dashes optional. */
const TIN = /^\d{3}-?\d{3}-?\d{3}(-?\d{3,5})?$/;

/** The organization's legal details. Empty optional fields clear the value. */
@InputType()
export class UpdateOrganizationProfileInput {
	@Field({ description: 'Registered business name (DTI / SEC).' })
	@IsString()
	@MinLength(2)
	@MaxLength(160)
	name: string;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(160)
	tradeName?: string | null;

	@Field(() => String, { nullable: true, description: 'BIR TIN, e.g. 123-456-789-000.' })
	@IsOptional()
	@Matches(TIN, { message: 'TIN is 9 digits plus an optional branch code, e.g. 123-456-789-000.' })
	tin?: string | null;

	@Field(() => VatRegistration)
	@IsIn(Object.values(VatRegistration))
	vatRegistration: VatRegistration;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(40)
	secOrDtiNo?: string | null;

	@Field(() => String, { nullable: true, description: 'https URL of the logo printed on documents.' })
	@IsOptional()
	@IsUrl({ require_protocol: true, protocols: ['https', 'http'] })
	@MaxLength(500)
	logoUrl?: string | null;
}

/** The selected clinic's profile. Empty optional fields clear the value. */
@InputType()
export class UpdateClinicProfileInput {
	@Field({ description: 'Short code printed in document numbers (2–8 capital letters or digits).' })
	@Matches(/^[A-Z0-9]{2,8}$/, { message: 'The code is 2–8 capital letters or digits.' })
	code: string;

	@Field()
	@IsString()
	@MinLength(2)
	@MaxLength(120)
	name: string;

	@Field(() => String, { nullable: true, description: 'BIR branch code, 3–5 digits (00000 for the head office).' })
	@IsOptional()
	@Matches(/^\d{3,5}$/, { message: 'The BIR branch code is 3–5 digits.' })
	birBranchCode?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(40)
	dohLicenseNo?: string | null;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD.' })
	@IsOptional()
	@Matches(DATE_ONLY)
	dohLicenseExpiry?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(40)
	philhealthAccreditNo?: string | null;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD.' })
	@IsOptional()
	@Matches(DATE_ONLY)
	philhealthAccreditExp?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(200)
	addressLine?: string | null;

	@Field(() => String, { nullable: true, description: 'PSGC code of the city or municipality.' })
	@IsOptional()
	@IsString()
	@MaxLength(12)
	cityMunicipalityCode?: string | null;

	@Field(() => String, { nullable: true, description: 'PSGC code of a barangay of that city or municipality.' })
	@IsOptional()
	@IsString()
	@MaxLength(12)
	barangayCode?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@Matches(/^\d{4}$/, { message: 'A ZIP code is 4 digits.' })
	zipCode?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(40)
	contactNo?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsEmail()
	@MaxLength(160)
	email?: string | null;

	@Field()
	@IsBoolean()
	isActive: boolean;
}
