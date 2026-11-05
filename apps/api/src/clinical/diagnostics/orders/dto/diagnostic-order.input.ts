import { Field, ID, InputType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsBoolean,
	IsIn,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	ValidateNested,
} from 'class-validator';

import { trim } from '../../../../common/validators/auth-input.validators.js';
import { WiseOriginInput } from '../../../wise-proposals/dto/wise-origin.input.js';
import { OrderPriority } from '../../models/diagnostic-enums.js';

export const MAX_TESTS_PER_ORDER = 20;

@InputType({
	description: "A lab or imaging request for a visit: one order, one item per test of the clinic's catalog.",
})
export class CreateDiagnosticOrderInput {
	@Field(() => ID)
	@IsUUID()
	encounterId: string;

	@Field(() => [ID], { description: "Tests of the organization's catalog (`diagnosticTests`)." })
	@ArrayMinSize(1)
	@ArrayMaxSize(MAX_TESTS_PER_ORDER)
	@IsUUID('all', { each: true })
	testIds: string[];

	@Field(() => OrderPriority, { nullable: true, description: 'Default ROUTINE.' })
	@IsOptional()
	@IsIn(Object.values(OrderPriority))
	priority?: OrderPriority | null;

	@Field(() => String, { nullable: true, description: 'The indication printed on the request.' })
	@IsOptional()
	@Transform(trim)
	@IsString()
	@MaxLength(500)
	clinicalInfo?: string | null;

	@Field(() => Boolean, { nullable: true, description: 'To be done outside the clinic (the request is printed).' })
	@IsOptional()
	@IsBoolean()
	isExternal?: boolean | null;

	@Field(() => String, {
		nullable: true,
		description: "The outside doctor of a walk-in lab request, when the user isn't a practitioner.",
	})
	@IsOptional()
	@Transform(trim)
	@IsString()
	@MaxLength(200)
	externalPhysician?: string | null;

	@Field(() => WiseOriginInput, { nullable: true, description: 'Set by a Wise card (`propose_order`).' })
	@IsOptional()
	@ValidateNested()
	@Type(() => WiseOriginInput)
	wiseOrigin?: WiseOriginInput | null;
}

@InputType({ description: 'Cancelling one test of an order (or every test still open), with the reason.' })
export class CancelDiagnosticOrderInput {
	@Field(() => ID)
	@IsUUID()
	orderId: string;

	@Field(() => ID, { nullable: true, description: 'One test of the order; without it, every test still open.' })
	@IsOptional()
	@IsUUID()
	itemId?: string | null;

	@Field({ description: 'Why, as the doctor or the lab sees it.' })
	@Transform(trim)
	@IsString()
	@MaxLength(500)
	reason: string;

	@Field(() => WiseOriginInput, {
		nullable: true,
		description: 'Set by a Wise card (`propose_cancel_order`, `propose_lab_order_step`).',
	})
	@IsOptional()
	@ValidateNested()
	@Type(() => WiseOriginInput)
	wiseOrigin?: WiseOriginInput | null;
}
