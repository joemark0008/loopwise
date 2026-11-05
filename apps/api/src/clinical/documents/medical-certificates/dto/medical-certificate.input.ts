import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
	IsBoolean,
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
import { CertificateType } from '../../documents.enums.js';

/**
 * A medical certificate draft. The DTO only checks shapes; the service parses it with the shared
 * `MedicalCertificateDraftSchema` (`@loopwise/shared/medical-certificate`).
 */
@InputType()
export class SaveMedicalCertificateInput {
	@Field(() => ID, { nullable: true, description: 'The draft to replace; a new draft when left out.' })
	@IsOptional()
	@IsUUID()
	id?: string | null;

	@Field(() => ID)
	@IsUUID()
	encounterId: string;

	@Field(() => CertificateType, { nullable: true, description: 'Default MEDICAL_CERTIFICATE.' })
	@IsOptional()
	@IsIn(Object.values(CertificateType))
	type?: CertificateType | null;

	@Field({ description: 'YYYY-MM-DD.' })
	@IsString()
	examinedOn: string;

	@Field()
	@IsString()
	@MaxLength(2000)
	diagnosisText: string;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	findings?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	recommendation?: string | null;

	@Field(() => Boolean, { nullable: true })
	@IsOptional()
	@IsBoolean()
	isFitToWork?: boolean | null;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD.' })
	@IsOptional()
	@IsString()
	restFrom?: string | null;

	@Field(() => Int, { nullable: true })
	@IsOptional()
	@IsNumber()
	restDays?: number | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	purpose?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	peClassification?: string | null;

	@Field(() => Int, {
		nullable: true,
		description:
			"The certificate's `version` the draft was made from; refused (STALE_VERSION) if it changed since.",
	})
	@IsOptional()
	@IsInt()
	expectedVersion?: number | null;

	@Field(() => WiseOriginInput, {
		nullable: true,
		description: 'Set by the Wise card (`propose_medical_certificate`).',
	})
	@IsOptional()
	@ValidateNested()
	@Type(() => WiseOriginInput)
	wiseOrigin?: WiseOriginInput | null;
}
