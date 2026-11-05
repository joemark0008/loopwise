import { Field, ID, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

import { WiseOriginInput } from '../../wise-proposals/dto/wise-origin.input.js';
import { AllergyType, Severity } from '../patients.enums.js';

/** A new allergy; parsed with the shared `AllergyDraftSchema` (`@loopwise/shared/encounter-record`). */
@InputType()
export class AddAllergyInput {
	@Field(() => ID)
	@IsUUID()
	patientId: string;

	@Field({ description: 'e.g. "Penicillin", "Shrimp".' })
	@IsString()
	@MaxLength(120)
	allergen: string;

	@Field(() => AllergyType, { nullable: true, description: 'Default DRUG.' })
	@IsOptional()
	@IsIn(Object.values(AllergyType))
	type?: AllergyType | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(300)
	reaction?: string | null;

	@Field(() => Severity, { nullable: true })
	@IsOptional()
	@IsIn(Object.values(Severity))
	severity?: Severity | null;

	@Field(() => WiseOriginInput, { nullable: true, description: 'Set by a Wise card (`propose_allergy`).' })
	@IsOptional()
	@ValidateNested()
	@Type(() => WiseOriginInput)
	wiseOrigin?: WiseOriginInput | null;
}

@InputType({ description: 'Voids an allergy recorded in error; it stays in the record, struck through.' })
export class VoidAllergyInput {
	@Field(() => ID)
	@IsUUID()
	id: string;

	@Field()
	@IsString()
	@MaxLength(300)
	reason: string;

	@Field(() => WiseOriginInput, { nullable: true, description: 'Set by a Wise card (`propose_remove_allergy`).' })
	@IsOptional()
	@ValidateNested()
	@Type(() => WiseOriginInput)
	wiseOrigin?: WiseOriginInput | null;
}
