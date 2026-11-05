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

import { WiseOriginInput } from '../../wise-proposals/dto/wise-origin.input.js';
import { DiagnosisType, Disposition } from '../encounters.enums.js';

/*
 * Inputs of the encounter record. The DTOs only check shapes; the record services parse the fields with the
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

	@Field(() => String, {
		nullable: true,
		description: 'Review of systems. Left out: kept as it is; null or empty: cleared.',
	})
	@IsOptional()
	@IsString()
	reviewOfSystems?: string | null;

	@Field(() => String, {
		nullable: true,
		description: 'Other subjective findings. Left out: kept as it is; null or empty: cleared.',
	})
	@IsOptional()
	@IsString()
	subjective?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	physicalExam?: string | null;

	@Field(() => String, {
		nullable: true,
		description: 'Other objective data. Left out: kept as it is; null or empty: cleared.',
	})
	@IsOptional()
	@IsString()
	objective?: string | null;

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

	@Field(() => Disposition, { nullable: true, description: 'How the visit ended.' })
	@IsOptional()
	@IsIn(Object.values(Disposition))
	disposition?: Disposition | null;

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

	@Field({ description: 'ICD-10 code of `icd10_codes`, e.g. `I10` or `E11.9`.' })
	@IsString()
	@MaxLength(10)
	icd10Code: string;

	@Field({ description: 'The diagnosis as printed, normally the ICD-10 title.' })
	@IsString()
	@MaxLength(300)
	description: string;

	@Field(() => DiagnosisType, {
		nullable: true,
		description:
			'Default: PRIMARY for the first diagnosis, else SECONDARY. A new PRIMARY demotes the previous one.',
	})
	@IsOptional()
	@IsIn(Object.values(DiagnosisType))
	type?: DiagnosisType | null;

	@Field(() => Boolean, { nullable: true, description: 'Default true; false for a provisional diagnosis.' })
	@IsOptional()
	@IsBoolean()
	isFinal?: boolean | null;

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

	@Field(() => DiagnosisType, { nullable: true, description: 'A new PRIMARY demotes the previous one.' })
	@IsOptional()
	@IsIn(Object.values(DiagnosisType))
	type?: DiagnosisType | null;

	@Field(() => Boolean, { nullable: true })
	@IsOptional()
	@IsBoolean()
	isFinal?: boolean | null;

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
