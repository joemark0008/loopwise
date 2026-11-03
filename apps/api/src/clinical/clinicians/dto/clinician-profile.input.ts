import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, MaxLength } from 'class-validator';

@InputType()
export class UpdateClinicianProfileInput {
	@Field(() => String, { nullable: true, description: 'e.g. "MD".' })
	@IsOptional()
	@IsString()
	@MaxLength(40)
	credentials?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(120)
	specialty?: string | null;

	@Field(() => String, { nullable: true, description: 'PRC license number.' })
	@IsOptional()
	@IsString()
	@MaxLength(20)
	prcLicenseNumber?: string | null;

	@Field(() => String, { nullable: true, description: 'Professional tax receipt number.' })
	@IsOptional()
	@IsString()
	@MaxLength(40)
	ptrNumber?: string | null;
}
