import { Field, ID, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

import { WiseOriginInput } from '../../wise-proposals/dto/wise-origin.input.js';

/**
 * A new encounter. The DTO only checks shapes; `EncounterService` parses the fields with the shared
 * `EncounterDraftSchema` (`@quarry/shared/encounter`), the same rules the form and the Wise card use.
 */
@InputType()
export class CreateEncounterInput {
	@Field(() => ID)
	@IsUUID()
	patientId: string;

	@Field(() => ID, { description: 'The facility of the visit (`myFacilities`).' })
	@IsUUID()
	facilityId: string;

	@Field()
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
