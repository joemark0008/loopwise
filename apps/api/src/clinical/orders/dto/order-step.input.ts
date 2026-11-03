import { Field, ID, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';

import { WiseOriginInput } from '../../wise-proposals/dto/wise-origin.input.js';

@InputType({ description: 'Rejecting or cancelling an order: the reason the other side sees.' })
export class OrderReasonInput {
	@Field(() => ID)
	@IsUUID()
	orderId: string;

	@Field()
	@IsString()
	@MinLength(1)
	@MaxLength(500)
	reason: string;

	@Field(() => WiseOriginInput, {
		nullable: true,
		description: 'Set by a Wise card (`propose_lab_order_step`, `propose_cancel_order`).',
	})
	@IsOptional()
	@ValidateNested()
	@Type(() => WiseOriginInput)
	wiseOrigin?: WiseOriginInput | null;
}
