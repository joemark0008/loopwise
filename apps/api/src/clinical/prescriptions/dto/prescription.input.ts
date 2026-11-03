import { Field, ID, InputType, Int } from '@nestjs/graphql';
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

import { MedicationRoute } from '../../../generated/prisma/enums.js';
import { WiseOriginInput } from '../../wise-proposals/dto/wise-origin.input.js';

/**
 * A prescription draft. The DTO only checks shapes; `PrescriptionService` parses it with the shared
 * `PrescriptionDraftSchema` (`@quarry/shared/prescription`), the same rules the form and the Wise card use.
 */
@InputType()
export class PrescriptionItemInput {
	@Field()
	@IsString()
	genericName: string;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	brandName?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	strength?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	form?: string | null;

	@Field()
	@IsString()
	dose: string;

	@Field(() => MedicationRoute, { nullable: true })
	@IsOptional()
	@IsIn(Object.values(MedicationRoute))
	route?: MedicationRoute | null;

	@Field()
	@IsString()
	frequency: string;

	@Field(() => Int, { nullable: true })
	@IsOptional()
	@IsNumber()
	durationDays?: number | null;

	@Field(() => Int)
	@IsNumber()
	quantity: number;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	quantityUnit?: string | null;

	@Field(() => Int, { nullable: true })
	@IsOptional()
	@IsNumber()
	refills?: number | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	instructions?: string | null;
}

@InputType()
export class SavePrescriptionInput {
	@Field(() => ID, { nullable: true, description: 'The draft to replace; a new draft when left out.' })
	@IsOptional()
	@IsUUID()
	id?: string | null;

	@Field(() => ID)
	@IsUUID()
	encounterId: string;

	@Field(() => [PrescriptionItemInput])
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PrescriptionItemInput)
	items: PrescriptionItemInput[];

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(2000)
	notes?: string | null;
	@Field(() => Int, {
		nullable: true,
		description: "The prescription's `version` the draft was made from; refused with CONFLICT if it changed since.",
	})
	@IsOptional()
	@IsInt()
	expectedVersion?: number | null;

	@Field(() => WiseOriginInput, { nullable: true, description: 'Set by the Wise card (`propose_prescription`).' })
	@IsOptional()
	@ValidateNested()
	@Type(() => WiseOriginInput)
	wiseOrigin?: WiseOriginInput | null;
}
