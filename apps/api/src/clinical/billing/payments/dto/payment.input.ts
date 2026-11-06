import { Field, Float, ID, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsIn,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Matches,
	MaxLength,
	ValidateNested,
} from 'class-validator';

import { WiseOriginInput } from '../../../wise-proposals/dto/wise-origin.input.js';
import { PaymentMethod } from '../../billing.enums.js';

/** One tender: `PaymentService` checks it with the shared `PaymentDraftSchema` (reference, check bank and date). */
@InputType()
export class PaymentTenderInput {
	@Field(() => PaymentMethod, { description: 'PHILHEALTH records a package (e.g. Konsulta) PhilHealth pays.' })
	@IsIn(Object.values(PaymentMethod))
	method: PaymentMethod;

	@Field(() => Float, { description: 'Pesos applied to the invoice.' })
	@IsNumber()
	amount: number;

	@Field(() => Float, { nullable: true, description: 'Cash handed over; the change is computed.' })
	@IsOptional()
	@IsNumber()
	tenderedAmount?: number | null;

	@Field(() => String, {
		nullable: true,
		description: 'Official receipt number (cash, optional), e-wallet / card / transfer reference, check number.',
	})
	@IsOptional()
	@IsString()
	@MaxLength(60)
	referenceNo?: string | null;

	@Field(() => String, { nullable: true, description: 'Check: the bank.' })
	@IsOptional()
	@IsString()
	@MaxLength(100)
	bankName?: string | null;

	@Field(() => String, { nullable: true, description: 'Check: its date (YYYY-MM-DD).' })
	@IsOptional()
	@Matches(/^\d{4}-\d{2}-\d{2}$/)
	checkDate?: string | null;
}

/** A payment against an issued invoice (one tender); a Wise card confirms with it. */
@InputType()
export class RecordPaymentInput extends PaymentTenderInput {
	@Field(() => ID)
	@IsUUID()
	invoiceId: string;

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

/** Split tender: several payments on one invoice at once (e.g. part cash, part GCash). */
@InputType()
export class RecordPaymentsInput {
	@Field(() => ID)
	@IsUUID()
	invoiceId: string;

	@Field(() => [PaymentTenderInput])
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(6)
	@ValidateNested({ each: true })
	@Type(() => PaymentTenderInput)
	tenders: PaymentTenderInput[];

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(300)
	notes?: string | null;

	@Field(() => Int, { nullable: true })
	@IsOptional()
	@IsInt()
	expectedVersion?: number | null;
}

@InputType()
export class VoidPaymentInput {
	@Field(() => ID)
	@IsUUID()
	paymentId: string;

	@Field()
	@IsString()
	@MaxLength(300)
	reason: string;
}
