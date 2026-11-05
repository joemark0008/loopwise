import { Field, Float, ID, InputType } from '@nestjs/graphql';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

import { ServiceCategory, TaxType } from '../../billing.enums.js';

/** An item of the organization's catalog. Without `id` a new one is added. */
@InputType()
export class SaveServiceItemInput {
	@Field(() => ID, { nullable: true })
	@IsOptional()
	@IsUUID()
	id?: string | null;

	@Field({ description: "Unique in the organization: capital letters, digits and '-', e.g. CONSULT-FU." })
	@Matches(/^[A-Z0-9][A-Z0-9-]{0,39}$/, { message: "A code is capital letters, digits and '-' (up to 40)." })
	code: string;

	@Field()
	@IsString()
	@MaxLength(160)
	@Matches(/\S/, { message: 'Name the service.' })
	name: string;

	@Field(() => ServiceCategory)
	@IsIn(Object.values(ServiceCategory))
	category: ServiceCategory;

	@Field(() => Float, { description: 'Pesos (VAT included when VATABLE).' })
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	@Max(10_000_000)
	defaultPrice: number;

	@Field(() => TaxType)
	@IsIn(Object.values(TaxType))
	taxType: TaxType;

	@Field()
	@IsBoolean()
	isPfShareable: boolean;

	@Field(() => ID, { nullable: true, description: 'The lab or imaging test this item bills.' })
	@IsOptional()
	@IsUUID()
	diagnosticTestId?: string | null;

	@Field(() => ID, { nullable: true, description: 'The medicine or supply this item bills.' })
	@IsOptional()
	@IsUUID()
	inventoryItemId?: string | null;

	@Field()
	@IsBoolean()
	isActive: boolean;
}

/** The selected clinic's own price for an item (and its HMO rate). */
@InputType()
export class SetClinicServicePriceInput {
	@Field(() => ID)
	@IsUUID()
	serviceItemId: string;

	@Field(() => Float)
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	@Max(10_000_000)
	price: number;

	@Field(() => Float, { nullable: true, description: 'HMO contracted rate; empty when the same.' })
	@IsOptional()
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	@Max(10_000_000)
	hmoPrice?: number | null;
}
