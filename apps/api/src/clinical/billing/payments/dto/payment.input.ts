import { Field, Float, ID, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

import { WiseOriginInput } from '../../../wise-proposals/dto/wise-origin.input.js';
import { PaymentMethod } from '../../billing.enums.js';

/** A payment against an issued invoice; `PaymentService` checks it with the shared `PaymentDraftSchema`. */
@InputType()
export class RecordPaymentInput {
	@Field(() => ID)
	@IsUUID()
	invoiceId: string;

	@Field(() => PaymentMethod, { description: 'PHILHEALTH records a package (e.g. Konsulta) PhilHealth pays.' })
	@IsIn(Object.values(PaymentMethod))
	method: PaymentMethod;

	@Field(() => Float, { description: 'Pesos applied to the invoice; at most its balance.' })
	@IsNumber()
	amount: number;

	@Field(() => Float, { nullable: true, description: 'Cash handed over; the change is computed.' })
	@IsOptional()
	@IsNumber()
	tenderedAmount?: number | null;

	@Field({ description: 'Official receipt number, e-wallet / card reference, or the PhilHealth package code.' })
	@IsString()
	@MaxLength(60)
	referenceNo: string;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(300)
	notes?: string | null;

	@Field(() => Int, { nullable: true, description: "The invoice's `version` the card showed." })
	@IsOptional()
	@IsInt()
	expectedVersion?: number | null;

	@Field(() => WiseOriginInput, { nullable: true, description: 'Set by a Wise card (`propose_bill_step`).' })
	@IsOptional()
	@ValidateNested()
	@Type(() => WiseOriginInput)
	wiseOrigin?: WiseOriginInput | null;
}
