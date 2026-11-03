import { Field, Float, ID, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
	IsArray,
	IsIn,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	ValidateNested,
} from 'class-validator';

import { BillDiscountKind, ChargeKind } from '../../../generated/prisma/enums.js';
import { WiseOriginInput } from '../../wise-proposals/dto/wise-origin.input.js';

/**
 * A bill draft. The DTO only checks shapes; `BillingService` parses it with the shared `BillDraftSchema`
 * (`@loopwise/shared/encounter-bill`) and computes the totals itself.
 */
@InputType()
export class ChargeInput {
	@Field(() => ChargeKind)
	@IsIn(Object.values(ChargeKind))
	kind: ChargeKind;

	@Field()
	@IsString()
	description: string;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	code?: string | null;

	@Field(() => Int)
	@IsNumber()
	quantity: number;

	@Field(() => Float, { description: 'Pesos.' })
	@IsNumber()
	unitPrice: number;
}

@InputType()
export class SaveEncounterBillInput {
	@Field(() => ID)
	@IsUUID()
	encounterId: string;

	@Field(() => [ChargeInput])
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ChargeInput)
	charges: ChargeInput[];

	@Field(() => BillDiscountKind, { nullable: true })
	@IsOptional()
	@IsIn(Object.values(BillDiscountKind))
	discountKind?: BillDiscountKind | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(40)
	philhealthPackageCode?: string | null;

	@Field(() => Float, { nullable: true, description: 'Pesos PhilHealth covers.' })
	@IsOptional()
	@IsNumber()
	philhealthCoverage?: number | null;
	@Field(() => Int, {
		nullable: true,
		description: "The bill's `version` the draft was made from; refused with CONFLICT if it changed since.",
	})
	@IsOptional()
	@IsInt()
	expectedVersion?: number | null;

	@Field(() => WiseOriginInput, { nullable: true, description: 'Set by the Wise card (`propose_charges`).' })
	@IsOptional()
	@ValidateNested()
	@Type(() => WiseOriginInput)
	wiseOrigin?: WiseOriginInput | null;
}

@InputType()
export class MarkBillPaidInput {
	@Field(() => ID)
	@IsUUID()
	id: string;

	@Field({ description: 'Official receipt number.' })
	@IsString()
	@MaxLength(40)
	orNumber: string;

	@Field(() => WiseOriginInput, { nullable: true, description: 'Set by a Wise card (`propose_bill_step`).' })
	@IsOptional()
	@ValidateNested()
	@Type(() => WiseOriginInput)
	wiseOrigin?: WiseOriginInput | null;
}
