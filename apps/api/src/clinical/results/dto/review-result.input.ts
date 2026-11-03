import { Field, ID, InputType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

import { trim } from '../../../common/validators/auth-input.validators.js';
import { WiseOriginInput } from '../../wise-proposals/dto/wise-origin.input.js';

@InputType()
export class ReviewResultInput {
	@Field(() => ID)
	@IsUUID()
	resultId: string;

	@Field(() => String, { nullable: true, description: "The reviewer's note, kept in the audit row." })
	@IsOptional()
	@Transform(trim)
	@IsString()
	@MaxLength(1000)
	note?: string | null;

	@Field(() => WiseOriginInput, { nullable: true, description: 'Set by a Wise card (`propose_result_review`).' })
	@IsOptional()
	@ValidateNested()
	@Type(() => WiseOriginInput)
	wiseOrigin?: WiseOriginInput | null;
}
