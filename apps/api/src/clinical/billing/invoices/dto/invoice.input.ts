import { Field, Float, ID, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
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

import { WiseOriginInput } from '../../../wise-proposals/dto/wise-origin.input.js';
import { DiscountType, TaxType } from '../../billing.enums.js';

/**
 * Invoice inputs. The DTOs check shapes; `InvoiceService` parses them with the shared rules
 * (`@loopwise/shared/invoice`) and computes every amount itself.
 */
@InputType()
export class InvoiceLineInput {
	@Field(() => ID, { nullable: true, description: 'The catalog item; else matched by name, else a free line.' })
	@IsOptional()
	@IsUUID()
	serviceItemId?: string | null;

	@Field()
	@IsString()
	@MaxLength(200)
	description: string;

	@Field(() => Float)
	@IsNumber()
	quantity: number;

	@Field(() => Float, { description: 'Pesos, VAT included for VATABLE items.' })
	@IsNumber()
	unitPrice: number;

	@Field(() => TaxType, { nullable: true, description: "Ignored for catalog items (the item's applies)." })
	@IsOptional()
	@IsIn(Object.values(TaxType))
	taxType?: TaxType | null;

	@Field(() => ID, { nullable: true, description: 'Whose fee the line is (a doctor of the clinic).' })
	@IsOptional()
	@IsUUID()
	practitionerId?: string | null;
}

@InputType()
export class SaveInvoiceDraftInput {
	@Field(() => ID)
	@IsUUID()
	encounterId: string;

	@Field(() => [InvoiceLineInput])
	@IsArray()
	@ArrayMaxSize(100)
	@ValidateNested({ each: true })
	@Type(() => InvoiceLineInput)
	lines: InvoiceLineInput[];

	@Field(() => DiscountType, { nullable: true, description: 'SENIOR_CITIZEN or PWD only.' })
	@IsOptional()
	@IsIn(['SENIOR_CITIZEN', 'PWD'])
	discountType?: DiscountType | null;

	@Field(() => ID, { nullable: true, description: "The patient's OSCA / PWD ID on file that was presented." })
	@IsOptional()
	@IsUUID()
	discountIdentificationId?: string | null;

	@Field(() => String, {
		nullable: true,
		description: 'Or its number as presented (matched against the IDs on file).',
	})
	@IsOptional()
	@IsString()
	@MaxLength(60)
	discountIdNumber?: string | null;

	@Field(() => DiscountType, { nullable: true, description: 'EMPLOYEE, PROMO or SPECIAL; never with SC/PWD.' })
	@IsOptional()
	@IsIn(['EMPLOYEE', 'PROMO', 'SPECIAL'])
	otherDiscountType?: DiscountType | null;

	@Field(() => Float, { nullable: true, description: 'Percent off (10 = 10%); or give an amount.' })
	@IsOptional()
	@IsNumber()
	otherDiscountPercent?: number | null;

	@Field(() => Float, { nullable: true, description: 'Pesos off; or give a percent.' })
	@IsOptional()
	@IsNumber()
	otherDiscountAmount?: number | null;

	@Field(() => ID, { nullable: true, description: 'Who approved the other discount.' })
	@IsOptional()
	@IsUUID()
	otherDiscountApprovedById?: string | null;

	@Field(() => Float, { nullable: true, description: 'Creditable withholding tax rate (0.02 = 2%, BIR 2307).' })
	@IsOptional()
	@IsNumber()
	withholdingTaxRate?: number | null;

	@Field(() => Int, {
		nullable: true,
		description: "The draft's `version` the change was made from; refused with STALE_VERSION if it moved.",
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
export class LoadInvoiceChargesInput {
	@Field(() => ID)
	@IsUUID()
	encounterId: string;

	@Field(() => Int, { nullable: true, description: "The draft's `version` (none when there is no draft yet)." })
	@IsOptional()
	@IsInt()
	expectedVersion?: number | null;
}

@InputType()
export class IssueInvoiceInput {
	@Field(() => ID)
	@IsUUID()
	id: string;

	@Field(() => Int, { nullable: true })
	@IsOptional()
	@IsInt()
	expectedVersion?: number | null;

	@Field(() => WiseOriginInput, { nullable: true, description: 'Set by a Wise card (`propose_bill_step`).' })
	@IsOptional()
	@ValidateNested()
	@Type(() => WiseOriginInput)
	wiseOrigin?: WiseOriginInput | null;
}

@InputType()
export class VoidInvoiceInput {
	@Field(() => ID)
	@IsUUID()
	id: string;

	@Field()
	@IsString()
	@MaxLength(300)
	reason: string;

	@Field(() => Int, { nullable: true })
	@IsOptional()
	@IsInt()
	expectedVersion?: number | null;

	@Field(() => WiseOriginInput, { nullable: true, description: 'Set by a Wise card (`propose_bill_step`).' })
	@IsOptional()
	@ValidateNested()
	@Type(() => WiseOriginInput)
	wiseOrigin?: WiseOriginInput | null;
}
