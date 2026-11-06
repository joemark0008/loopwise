import { Field, Float, ID, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
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

/** One line of a delivery: a lot of an item. */
@InputType()
export class ReceiveStockLineInput {
	@Field(() => ID)
	@IsUUID()
	itemId: string;

	@Field({ description: 'The lot (batch) number on the box.' })
	@IsString()
	@MaxLength(60)
	@Matches(/\S/, { message: 'Give the lot number.' })
	lotNo: string;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD; required for medicines and vaccines.' })
	@IsOptional()
	@Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Expiry is YYYY-MM-DD.' })
	expiryDate?: string | null;

	@Field(() => Float, { description: 'Units received (in the item unit, not boxes).' })
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0.01)
	@Max(1_000_000)
	quantity: number;

	@Field(() => Float, { description: 'Pesos per unit.' })
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	@Max(10_000_000)
	unitCost: number;
}

/** A delivery from a supplier (DR / supplier invoice) received into the selected clinic's stock. */
@InputType()
export class ReceiveStockInput {
	@Field(() => ID)
	@IsUUID()
	supplierId: string;

	@Field(() => String, { nullable: true, description: "The supplier's delivery receipt (DR) number." })
	@IsOptional()
	@IsString()
	@MaxLength(60)
	deliveryReceiptNo?: string | null;

	@Field(() => String, { nullable: true, description: "The supplier's sales invoice number." })
	@IsOptional()
	@IsString()
	@MaxLength(60)
	supplierInvoiceNo?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	remarks?: string | null;

	@Field(() => [ReceiveStockLineInput])
	@ArrayMinSize(1, { message: 'Add at least one line.' })
	@ArrayMaxSize(200)
	@ValidateNested({ each: true })
	@Type(() => ReceiveStockLineInput)
	lines: ReceiveStockLineInput[];
}
