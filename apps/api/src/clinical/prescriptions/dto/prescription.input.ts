import { Field, Float, ID, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	ValidateNested,
} from 'class-validator';

import { WiseOriginInput } from '../../wise-proposals/dto/wise-origin.input.js';

/**
 * A prescription draft. The DTO only checks shapes; `PrescriptionService` parses it with the shared
 * `PrescriptionDraftSchema` (`@loopwise/shared/prescription`), the same rules the form and the Wise card use.
 */
@InputType()
export class PrescriptionItemInput {
	@Field({ description: 'Generic name (required, RA 6675).' })
	@IsString()
	@MaxLength(200)
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
	dosageForm?: string | null;

	@Field(() => String, { nullable: true, description: 'Per intake, e.g. "1 tablet"; writes the sig when none.' })
	@IsOptional()
	@IsString()
	dose?: string | null;

	@Field(() => String, {
		nullable: true,
		description: 'PO (default), SL, TOP, INH, NAS, OPH, OTIC, PR, PV, IM, IV, SC.',
	})
	@IsOptional()
	@IsString()
	route?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	frequency?: string | null;

	@Field(() => Int, { nullable: true })
	@IsOptional()
	@IsNumber()
	durationDays?: number | null;

	@Field(() => Boolean, { nullable: true, description: 'As needed (PRN).' })
	@IsOptional()
	@IsBoolean()
	isPrn?: boolean | null;

	@Field(() => String, { nullable: true, description: 'The directions as printed.' })
	@IsOptional()
	@IsString()
	@MaxLength(1000)
	sig?: string | null;

	@Field(() => Float)
	@IsNumber()
	quantity: number;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	unit?: string | null;

	@Field(() => String, { nullable: true, description: 'Required for dangerous drugs (RA 9165).' })
	@IsOptional()
	@IsString()
	quantityInWords?: string | null;
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

	@Field(() => Boolean, { nullable: true, description: 'A dangerous drug (S2 / yellow Rx, RA 9165).' })
	@IsOptional()
	@IsBoolean()
	isDangerousDrug?: boolean | null;

	@Field(() => String, { nullable: true, description: 'The DOH dangerous-drugs prescription form serial number.' })
	@IsOptional()
	@IsString()
	s2FormSerialNo?: string | null;

	@Field(() => Int, {
		nullable: true,
		description:
			"The prescription's `version` the draft was made from; refused (STALE_VERSION) if it changed since.",
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
