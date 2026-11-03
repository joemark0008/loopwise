import { Field, ID, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsIn,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	ValidateNested,
} from 'class-validator';

import { OrderPriority } from '../../../generated/prisma/enums.js';
import { WiseOriginInput } from '../../wise-proposals/dto/wise-origin.input.js';

@InputType({ description: 'A test ordered from an encounter, sent to a lab or imaging facility.' })
export class CreateEncounterOrderInput {
	@Field(() => ID)
	@IsUUID()
	encounterId: string;

	@Field({ description: 'LOINC code from the test list (`orderableTests`).' })
	@IsString()
	@MaxLength(20)
	code: string;

	@Field(() => ID, { description: 'The lab, imaging center or hospital (`orderTargets`).' })
	@IsUUID()
	targetOrgId: string;

	@Field(() => OrderPriority, { nullable: true })
	@IsOptional()
	@IsIn(Object.values(OrderPriority))
	priority?: OrderPriority | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(1000)
	notes?: string | null;
}

@InputType({ description: 'Several tests ordered from one encounter, sent to one facility, in one transaction.' })
export class CreateEncounterOrdersInput {
	@Field(() => ID)
	@IsUUID()
	encounterId: string;

	@Field(() => [String], { description: 'LOINC codes from the test list (`orderableTests`).' })
	@ArrayMinSize(1)
	@ArrayMaxSize(10)
	@IsString({ each: true })
	@MaxLength(20, { each: true })
	codes: string[];

	@Field(() => ID, { description: 'The lab, imaging center or hospital (`orderTargets`).' })
	@IsUUID()
	targetOrgId: string;

	@Field(() => OrderPriority, { nullable: true })
	@IsOptional()
	@IsIn(Object.values(OrderPriority))
	priority?: OrderPriority | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(1000)
	notes?: string | null;

	@Field(() => WiseOriginInput, { nullable: true, description: 'Set by a Wise card (`propose_order`).' })
	@IsOptional()
	@ValidateNested()
	@Type(() => WiseOriginInput)
	wiseOrigin?: WiseOriginInput | null;
}
