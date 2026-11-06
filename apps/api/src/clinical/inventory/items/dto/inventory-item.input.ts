import { Field, Float, ID, InputType, Int } from '@nestjs/graphql';
import {
	IsBoolean,
	IsIn,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Matches,
	Max,
	MaxLength,
	Min,
} from 'class-validator';

import { TaxType } from '../../../billing/billing.enums.js';
import { ItemCategory } from '../../inventory.enums.js';

/** An item of the organization's inventory master. Without `id` a new one is added. */
@InputType()
export class SaveInventoryItemInput {
	@Field(() => ID, { nullable: true })
	@IsOptional()
	@IsUUID()
	id?: string | null;

	@Field({ description: "Unique in the organization: capital letters, digits and '-', e.g. MED-AMOX-500." })
	@Matches(/^[A-Z0-9][A-Z0-9-]{0,39}$/, { message: "A SKU is capital letters, digits and '-' (up to 40)." })
	sku: string;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	barcode?: string | null;

	@Field({ description: 'Display name, generic name first: "Amoxicillin 500 mg capsule".' })
	@IsString()
	@MaxLength(160)
	@Matches(/\S/, { message: 'Name the item.' })
	name: string;

	@Field(() => ItemCategory)
	@IsIn(Object.values(ItemCategory))
	category: ItemCategory;

	@Field(() => String, { nullable: true, description: 'Required for a medicine or vaccine (RA 6675).' })
	@IsOptional()
	@IsString()
	@MaxLength(120)
	genericName?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(120)
	brandName?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(60)
	strength?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(60)
	dosageForm?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(120)
	manufacturer?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(40)
	fdaCprNo?: string | null;

	@Field()
	@IsBoolean()
	isRxOnly: boolean;

	@Field()
	@IsBoolean()
	isDangerousDrug: boolean;

	@Field()
	@IsBoolean()
	isAntimicrobial: boolean;

	@Field()
	@IsBoolean()
	isPnf: boolean;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(80)
	storageCondition?: string | null;

	@Field()
	@IsString()
	@MaxLength(20)
	@Matches(/\S/, { message: 'Give the unit (tab, cap, vial, pc …).' })
	unitOfMeasure: string;

	@Field(() => Int, { nullable: true })
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(100_000)
	packSize?: number | null;

	@Field(() => TaxType)
	@IsIn(Object.values(TaxType))
	taxType: TaxType;

	@Field(() => Float, { nullable: true })
	@IsOptional()
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	@Max(10_000_000)
	defaultCost?: number | null;

	@Field(() => Float, { nullable: true, description: 'Pesos per unit (VAT included when VATABLE).' })
	@IsOptional()
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	@Max(10_000_000)
	sellingPrice?: number | null;

	@Field(() => Float, { nullable: true, description: 'Alert when unexpired stock is at or below this.' })
	@IsOptional()
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	@Max(10_000_000)
	reorderLevel?: number | null;

	@Field()
	@IsBoolean()
	isActive: boolean;
}

/** Links an item to the catalog service that sells it, or unlinks it (`serviceItemId` null). */
@InputType()
export class SetInventoryServiceLinkInput {
	@Field(() => ID)
	@IsUUID()
	itemId: string;

	@Field(() => ID, { nullable: true })
	@IsOptional()
	@IsUUID()
	serviceItemId?: string | null;
}
