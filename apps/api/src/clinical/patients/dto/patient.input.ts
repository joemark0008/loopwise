import { Field, ID, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

import { Sex } from '../../../generated/prisma/enums.js';
import { WiseOriginInput } from '../../wise-proposals/dto/wise-origin.input.js';

/**
 * The fields of a patient being registered. The DTO only checks shapes; `PatientService` parses them with the shared
 * `PatientDraftSchema` (`@loopwise/shared/patient-registration`), the same rules the form and the Wise card use.
 */
@InputType()
export class PatientDraftInput {
	@Field(() => ID, { description: 'The facility registering the patient (`myFacilities`).' })
	@IsUUID()
	facilityId: string;

	@Field()
	@IsString()
	@MaxLength(200)
	givenName: string;

	@Field()
	@IsString()
	@MaxLength(200)
	familyName: string;

	@Field({ description: 'YYYY-MM-DD.' })
	@IsString()
	birthDate: string;

	@Field(() => Sex)
	@IsIn(Object.values(Sex))
	sex: Sex;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(40)
	phone?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	preferredLanguage?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(200)
	mrn?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(40)
	philHealthId?: string | null;
}

@InputType()
export class RegisterPatientInput extends PatientDraftInput {
	@Field({ description: 'The patient agreed to be registered; sets `consentAt`. Registration needs it.' })
	@IsBoolean()
	consentGiven: boolean;

	@Field({
		defaultValue: false,
		description:
			'Register although a patient with the same name, birth date and sex exists (never for an identifier match).',
	})
	@IsOptional()
	@IsBoolean()
	acknowledgeDuplicates: boolean;

	@Field(() => WiseOriginInput, {
		nullable: true,
		description: 'Set by the Wise card (`propose_patient_registration`).',
	})
	@IsOptional()
	@ValidateNested()
	@Type(() => WiseOriginInput)
	wiseOrigin?: WiseOriginInput | null;
}

@InputType({ description: 'Use an existing patient that `checkPatientDuplicates` matched, instead of a new one.' })
export class LinkExistingPatientInput extends PatientDraftInput {
	@Field(() => ID)
	@IsUUID()
	patientId: string;

	@Field()
	@IsBoolean()
	consentGiven: boolean;

	@Field(() => WiseOriginInput, {
		nullable: true,
		description: 'Set by the Wise card (`propose_patient_registration`).',
	})
	@IsOptional()
	@ValidateNested()
	@Type(() => WiseOriginInput)
	wiseOrigin?: WiseOriginInput | null;
}

@InputType()
export class SearchPatientsInput {
	@Field(() => String, { nullable: true, description: 'Name words, or an exact MRN / PhilHealth number.' })
	@IsOptional()
	@IsString()
	@MaxLength(200)
	query?: string | null;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD.' })
	@IsOptional()
	@IsString()
	birthDate?: string | null;
}

@InputType({ description: "Changes a patient's contact details; names, birth date, sex and identifiers stay." })
export class UpdatePatientInput {
	@Field(() => ID)
	@IsUUID()
	patientId: string;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(40)
	phone?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(40)
	preferredLanguage?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(120)
	barangay?: string | null;

	@Field(() => WiseOriginInput, { nullable: true, description: 'Set by a Wise card (`propose_patient_update`).' })
	@IsOptional()
	@ValidateNested()
	@Type(() => WiseOriginInput)
	wiseOrigin?: WiseOriginInput | null;
}
