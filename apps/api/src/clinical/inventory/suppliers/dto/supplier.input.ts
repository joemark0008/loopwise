import { Field, ID, InputType } from '@nestjs/graphql';
import { IsBoolean, IsEmail, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

/** A supplier of the organization. Without `id` a new one is added. */
@InputType()
export class SaveSupplierInput {
	@Field(() => ID, { nullable: true })
	@IsOptional()
	@IsUUID()
	id?: string | null;

	@Field()
	@IsString()
	@MaxLength(160)
	@Matches(/\S/, { message: 'Name the supplier.' })
	name: string;

	@Field(() => String, { nullable: true, description: 'BIR TIN, e.g. 123-456-789-000.' })
	@IsOptional()
	@Matches(/^$|^\d{3}-?\d{3}-?\d{3}(-?\d{3,5})?$/, { message: 'A TIN is 9 digits plus the branch code.' })
	tin?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(300)
	address?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(120)
	contactPerson?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(40)
	contactNo?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsEmail({}, { message: 'Enter a valid email.' })
	email?: string | null;

	@Field(() => String, { nullable: true, description: 'FDA License to Operate of the distributor.' })
	@IsOptional()
	@IsString()
	@MaxLength(40)
	fdaLtoNo?: string | null;

	@Field()
	@IsBoolean()
	isActive: boolean;
}
