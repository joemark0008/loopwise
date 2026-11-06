import { Field, Float, ID, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsIn,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Matches,
	Max,
	MaxLength,
	Min,
	ValidateNested,
} from 'class-validator';

import { AdjustmentDirection } from '../../inventory.enums.js';

/** A count correction of one lot (a stock take, a found box), always with the reason. */
@InputType()
export class AdjustStockInput {
	@Field(() => ID)
	@IsUUID()
	lotId: string;

	@Field(() => AdjustmentDirection)
	@IsIn(Object.values(AdjustmentDirection))
	direction: AdjustmentDirection;

	@Field(() => Float)
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0.01)
	@Max(1_000_000)
	quantity: number;

	@Field()
	@IsString()
	@MaxLength(300)
	@Matches(/\S/, { message: 'Give the reason for the adjustment.' })
	reason: string;
}

/** Disposal of an expired lot (all of it unless `quantity`). */
@InputType()
export class DisposeExpiredStockInput {
	@Field(() => ID)
	@IsUUID()
	lotId: string;

	@Field(() => Float, { nullable: true, description: 'Default: everything left in the lot.' })
	@IsOptional()
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0.01)
	@Max(1_000_000)
	quantity?: number | null;

	@Field(() => String, { nullable: true, description: 'e.g. "Returned to the FDA-accredited disposal service".' })
	@IsOptional()
	@IsString()
	@MaxLength(300)
	reason?: string | null;
}

/** Stock lost to damage (broken vial, cold chain break), with what happened. */
@InputType()
export class RecordDamagedStockInput {
	@Field(() => ID)
	@IsUUID()
	lotId: string;

	@Field(() => Float)
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0.01)
	@Max(1_000_000)
	quantity: number;

	@Field()
	@IsString()
	@MaxLength(300)
	@Matches(/\S/, { message: 'Say what happened.' })
	reason: string;
}

/** One supply used on a visit. Without `lotId`, first expiry first out. */
@InputType()
export class ConsumptionLineInput {
	@Field(() => ID)
	@IsUUID()
	itemId: string;

	@Field(() => ID, { nullable: true })
	@IsOptional()
	@IsUUID()
	lotId?: string | null;

	@Field(() => Float)
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0.01)
	@Max(100_000)
	quantity: number;
}

/** Supplies used on a visit (a procedure, the lab), named by the visit number. */
@InputType()
export class RecordConsumptionInput {
	@Field({ description: 'The visit number, e.g. TAG-ENC-2026-000012.' })
	@IsString()
	@MaxLength(40)
	@Matches(/\S/, { message: 'Give the visit number.' })
	encounterNo: string;

	@Field(() => String, { nullable: true, description: 'e.g. "Wound dressing", "CBC run".' })
	@IsOptional()
	@IsString()
	@MaxLength(300)
	reason?: string | null;

	@Field(() => [ConsumptionLineInput])
	@ArrayMinSize(1, { message: 'Add at least one supply.' })
	@ArrayMaxSize(50)
	@ValidateNested({ each: true })
	@Type(() => ConsumptionLineInput)
	lines: ConsumptionLineInput[];
}
