import { Field, Float, ID, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
	IsBoolean,
	IsIn,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	ValidateNested,
} from 'class-validator';

import { AllergyKind, AllergySeverity, DiagnosisCertainty } from '../../../generated/prisma/enums.js';
import { WiseOriginInput } from '../../wise-proposals/dto/wise-origin.input.js';

/*
 * Inputs of the encounter record. The DTOs only check shapes; `EncounterRecordService` parses the fields with the
 * shared rules (`@loopwise/shared/encounter-record`, `@loopwise/shared/vitals`), the same the forms and Wise cards use.
 */

@InputType()
export class UpdateEncounterNoteInput {
	@Field(() => ID)
	@IsUUID()
	encounterId: string;

	@Field({ description: 'The chief complaint.' })
	@IsString()
	@MaxLength(400)
	reason: string;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	history?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	physicalExam?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	assessment?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	plan?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	patientInstructions?: string | null;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD.' })
	@IsOptional()
	@IsString()
	followUpOn?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	notes?: string | null;

	@Field(() => Int, {
		nullable: true,
		description: "The encounter's `version` the edit was made from; refused with CONFLICT if it changed since.",
	})
	@IsOptional()
	@IsInt()
	expectedVersion?: number | null;

	@Field(() => WiseOriginInput, { nullable: true, description: 'Set by a Wise card (`propose_encounter_note`).' })
	@IsOptional()
	@ValidateNested()
	@Type(() => WiseOriginInput)
	wiseOrigin?: WiseOriginInput | null;
}

@InputType()
export class RecordVitalsInput {
	@Field(() => ID)
	@IsUUID()
	encounterId: string;

	@Field(() => WiseOriginInput, {
		nullable: true,
		description: 'Set when completing a confirmed `propose_encounter` card (its drafted vitals and diagnoses).',
	})
	@IsOptional()
	@ValidateNested()
	@Type(() => WiseOriginInput)
	wiseOrigin?: WiseOriginInput | null;

	@Field(() => Int, { nullable: true })
	@IsOptional()
	@IsNumber()
	systolicMmHg?: number | null;

	@Field(() => Int, { nullable: true })
	@IsOptional()
	@IsNumber()
	diastolicMmHg?: number | null;

	@Field(() => Int, { nullable: true })
	@IsOptional()
	@IsNumber()
	heartRateBpm?: number | null;

	@Field(() => Int, { nullable: true })
	@IsOptional()
	@IsNumber()
	respiratoryRate?: number | null;

	@Field(() => Float, { nullable: true })
	@IsOptional()
	@IsNumber()
	temperatureC?: number | null;

	@Field(() => Int, { nullable: true })
	@IsOptional()
	@IsNumber()
	spo2Pct?: number | null;

	@Field(() => Float, { nullable: true })
	@IsOptional()
	@IsNumber()
	weightKg?: number | null;

	@Field(() => Float, { nullable: true })
	@IsOptional()
	@IsNumber()
	heightCm?: number | null;

	@Field(() => Int, { nullable: true })
	@IsOptional()
	@IsNumber()
	bloodGlucoseMgDl?: number | null;

	@Field(() => Int, { nullable: true })
	@IsOptional()
	@IsNumber()
	painScore?: number | null;
}

@InputType()
export class AddDiagnosisInput {
	@Field(() => ID)
	@IsUUID()
	encounterId: string;

	@Field(() => WiseOriginInput, {
		nullable: true,
		description: 'Set when completing a confirmed `propose_encounter` card (its drafted vitals and diagnoses).',
	})
	@IsOptional()
	@ValidateNested()
	@Type(() => WiseOriginInput)
	wiseOrigin?: WiseOriginInput | null;

	@Field({ description: 'ICD-10 (WHO 2010), e.g. `I10` or `E11.9`.' })
	@IsString()
	@MaxLength(10)
	icd10Code: string;

	@Field({ description: 'The diagnosis as written, normally the ICD-10 title.' })
	@IsString()
	@MaxLength(300)
	display: string;

	@Field(() => DiagnosisCertainty, { nullable: true })
	@IsOptional()
	@IsIn(Object.values(DiagnosisCertainty))
	certainty?: DiagnosisCertainty | null;

	@Field(() => Boolean, {
		nullable: true,
		description: 'Makes it the primary diagnosis (the previous one stops being).',
	})
	@IsOptional()
	@IsBoolean()
	isPrimary?: boolean | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	notes?: string | null;
}

@InputType()
export class UpdateDiagnosisInput {
	@Field(() => ID)
	@IsUUID()
	id: string;

	@Field(() => DiagnosisCertainty, { nullable: true })
	@IsOptional()
	@IsIn(Object.values(DiagnosisCertainty))
	certainty?: DiagnosisCertainty | null;

	@Field(() => Boolean, { nullable: true })
	@IsOptional()
	@IsBoolean()
	isPrimary?: boolean | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	notes?: string | null;

	@Field(() => WiseOriginInput, { nullable: true, description: 'Set by a Wise card (`propose_diagnosis`).' })
	@IsOptional()
	@ValidateNested()
	@Type(() => WiseOriginInput)
	wiseOrigin?: WiseOriginInput | null;
}

@InputType({ description: 'Voids a record entry entered in error; it stays in the record, struck through.' })
export class VoidEntryInput {
	@Field(() => ID)
	@IsUUID()
	id: string;

	@Field()
	@IsString()
	@MaxLength(300)
	reason: string;
	@Field(() => WiseOriginInput, {
		nullable: true,
		description: 'Set by a Wise card (`propose_void_*`, `propose_bill_step`): verified and settled with the void.',
	})
	@IsOptional()
	@ValidateNested()
	@Type(() => WiseOriginInput)
	wiseOrigin?: WiseOriginInput | null;
}

@InputType()
export class AddAllergyInput {
	@Field(() => ID)
	@IsUUID()
	patientId: string;

	@Field(() => ID, { description: 'The facility recording it (`myFacilities`).' })
	@IsUUID()
	facilityId: string;

	@Field()
	@IsString()
	@MaxLength(120)
	substance: string;

	@Field(() => AllergyKind, { nullable: true })
	@IsOptional()
	@IsIn(Object.values(AllergyKind))
	kind?: AllergyKind | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	reaction?: string | null;

	@Field(() => AllergySeverity, { nullable: true })
	@IsOptional()
	@IsIn(Object.values(AllergySeverity))
	severity?: AllergySeverity | null;
	@Field(() => WiseOriginInput, { nullable: true, description: 'Set by a Wise card (`propose_allergy`).' })
	@IsOptional()
	@ValidateNested()
	@Type(() => WiseOriginInput)
	wiseOrigin?: WiseOriginInput | null;
}

@InputType({ description: 'Voids an allergy recorded in error; it stays in the record, struck through.' })
export class VoidAllergyInput extends VoidEntryInput {}
