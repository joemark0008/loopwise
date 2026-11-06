import { Field, Float, ID, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min,
	ValidateNested,
} from 'class-validator';

/** What is handed over for one prescribed medicine. */
@InputType()
export class DispenseLineInput {
	@Field(() => ID)
	@IsUUID()
	prescriptionItemId: string;

	@Field(() => ID, { description: 'The stock item given: the prescribed one or an equivalent generic.' })
	@IsUUID()
	itemId: string;

	@Field(() => ID, { nullable: true, description: 'The lot taken from; default first expiry first out.' })
	@IsOptional()
	@IsUUID()
	lotId?: string | null;

	@Field(() => Float, { description: 'Units handed over now (at most what is left on the Rx).' })
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0.01)
	@Max(100_000)
	quantity: number;

	@Field(() => String, { nullable: true, description: 'Why another product of the generic was given.' })
	@IsOptional()
	@IsString()
	@MaxLength(300)
	substitutionReason?: string | null;
}

/** Dispenses some or all of an issued prescription's medicines. */
@InputType()
export class DispensePrescriptionInput {
	@Field(() => ID)
	@IsUUID()
	prescriptionId: string;

	@Field(() => [DispenseLineInput])
	@ArrayMinSize(1, { message: 'Choose at least one medicine to dispense.' })
	@ArrayMaxSize(50)
	@ValidateNested({ each: true })
	@Type(() => DispenseLineInput)
	lines: DispenseLineInput[];
}
