import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

import { WiseOriginInput } from '../../wise-proposals/dto/wise-origin.input.js';
import { EncounterStatus, EncounterType } from '../encounters.enums.js';

/**
 * A new encounter. The DTO only checks shapes; `EncounterService` parses the fields with the shared
 * `EncounterDraftSchema` (`@loopwise/shared/encounter`), the same rules the form and the Wise card use.
 */
@InputType()
export class CreateEncounterInput {
	@Field(() => ID)
	@IsUUID()
	patientId: string;

	@Field(() => ID, { description: 'The clinic of the visit (`myCareClinics`).' })
	@IsUUID()
	clinicId: string;

	@Field(() => EncounterType, { nullable: true, description: 'Default CONSULTATION.' })
	@IsOptional()
	@IsIn(Object.values(EncounterType))
	type?: EncounterType | null;

	@Field(() => EncounterStatus, {
		nullable: true,
		description: 'OPEN (checked in) or IN_PROGRESS (with the doctor). Default: IN_PROGRESS for a practitioner.',
	})
	@IsOptional()
	@IsIn(['OPEN', 'IN_PROGRESS'])
	status?: EncounterStatus | null;

	@Field({ description: 'The chief complaint.' })
	@IsString()
	@MaxLength(400)
	reason: string;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(20_000)
	notes?: string | null;

	@Field(() => String, { nullable: true, description: 'ISO 8601; now when left out.' })
	@IsOptional()
	@IsString()
	startedAt?: string | null;

	@Field(() => ID, { nullable: true, description: "The patient's chart chat, when Wise drafted the encounter." })
	@IsOptional()
	@IsUUID()
	sourceChatId?: string | null;

	@Field(() => WiseOriginInput, { nullable: true, description: 'Set by the Wise card (`propose_encounter`).' })
	@IsOptional()
	@ValidateNested()
	@Type(() => WiseOriginInput)
	wiseOrigin?: WiseOriginInput | null;
}

@InputType({ description: 'Moves a visit along its status machine (`EncounterStatus`).' })
export class TransitionEncounterInput {
	@Field(() => ID)
	@IsUUID()
	encounterId: string;

	@Field(() => EncounterStatus)
	@IsIn(Object.values(EncounterStatus))
	status: EncounterStatus;

	@Field(() => Int, { nullable: true, description: "The encounter's `version` on screen; refused if it changed." })
	@IsOptional()
	@IsInt()
	expectedVersion?: number | null;

	@Field(() => String, { nullable: true, description: 'Why, for a cancellation.' })
	@IsOptional()
	@IsString()
	@MaxLength(300)
	reason?: string | null;
}

@InputType()
export class ClinicEncountersInput {
	@Field(() => ID)
	@IsUUID()
	clinicId: string;

	@Field(() => [EncounterStatus], { nullable: true, description: 'Default: every status but CANCELLED.' })
	@IsOptional()
	@IsIn(Object.values(EncounterStatus), { each: true })
	statuses?: EncounterStatus[] | null;

	@Field(() => String, { nullable: true, description: 'Visits started on or after this ISO 8601 time.' })
	@IsOptional()
	@IsString()
	startedFrom?: string | null;
}
