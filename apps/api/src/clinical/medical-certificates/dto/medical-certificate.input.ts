import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

import { WorkFitness } from '../../../generated/prisma/enums.js';
import { WiseOriginInput } from '../../wise-proposals/dto/wise-origin.input.js';

/**
 * A medical certificate draft. The DTO only checks shapes; `MedicalCertificateService` parses it with the shared
 * `MedicalCertificateDraftSchema` (`@quarry/shared/medical-certificate`).
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

	@Field({ description: 'YYYY-MM-DD.' })
	@IsString()
	examinedOn: string;

	@Field()
	@IsString()
	diagnosisText: string;

	@Field(() => WorkFitness, { nullable: true })
	@IsOptional()
	@IsIn(Object.values(WorkFitness))
	fitness?: WorkFitness | null;

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
	remarks?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	purpose?: string | null;
	@Field(() => Int, {
		nullable: true,
		description: "The certificate's `version` the draft was made from; refused with CONFLICT if it changed since.",
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
