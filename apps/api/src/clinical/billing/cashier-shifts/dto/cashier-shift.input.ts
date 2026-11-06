import { Field, Float, ID, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	IsArray,
	IsInt,
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

const DATE = /^\d{4}-\d{2}-\d{2}$/;

@InputType()
export class OpenCashierShiftInput {
	@Field(() => Float, { description: 'The cash float in the drawer (pesos).' })
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	@Max(10_000_000)
	openingCash: number;
}

@InputType()
export class CashDenominationInput {
	@Field(() => Float, {
		description: 'A peso bill or coin: 1000, 500, 200, 100, 50, 20, 10, 5, 1, 0.25, 0.1, 0.05, 0.01.',
	})
	@IsNumber()
	denomination: number;

	@Field(() => Int)
	@IsInt()
	@Min(0)
	@Max(1_000_000)
	count: number;
}

@InputType()
export class CloseCashierShiftInput {
	@Field(() => ID)
	@IsUUID()
	shiftId: string;

	@Field(() => [CashDenominationInput], { description: 'The cash counted, by bill and coin.' })
	@IsArray()
	@ArrayMaxSize(20)
	@ValidateNested({ each: true })
	@Type(() => CashDenominationInput)
	denominations: CashDenominationInput[];

	@Field(() => String, { nullable: true, description: 'Why the count differs, when it does.' })
	@IsOptional()
	@IsString()
	@MaxLength(300)
	remarks?: string | null;
}

@InputType()
export class CashierShiftsInput {
	@Field({ description: 'First day (YYYY-MM-DD, Manila).' })
	@Matches(DATE)
	from: string;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@Matches(DATE)
	to?: string | null;
}
