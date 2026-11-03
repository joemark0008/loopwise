import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

import { trim } from '../../common/validators/auth-input.validators.js';

@InputType()
export class CreateFacilityKeyInput {
	@Field({ description: 'What the key is for, e.g. "LIS edge connector".' })
	@Transform(trim)
	@IsString()
	@MinLength(1)
	@MaxLength(100)
	name: string;
}
