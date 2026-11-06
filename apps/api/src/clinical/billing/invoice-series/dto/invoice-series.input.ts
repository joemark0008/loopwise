import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

import { InvoiceDocType } from '../../billing.enums.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A new BIR series for the selected clinic. */
@InputType()
export class CreateInvoiceSeriesInput {
	@Field(() => InvoiceDocType, { nullable: true, description: 'Default SALES_INVOICE.' })
	@IsOptional()
	@IsIn(Object.values(InvoiceDocType))
	docType?: InvoiceDocType | null;

	@Field(() => String, { nullable: true, description: 'Printed before the number, e.g. "SI-".' })
	@IsOptional()
	@IsString()
	@MaxLength(12)
	prefix?: string | null;

	@Field(() => Int)
	@IsInt()
	@Min(1)
	@Max(999_999_999)
	startNo: number;

	@Field(() => Int)
	@IsInt()
	@Min(1)
	@Max(999_999_999)
	endNo: number;

	@Field({ description: 'ATP number or CAS / PTU permit number.' })
	@IsString()
	@MaxLength(60)
	permitNo: string;

	@Field({ description: 'YYYY-MM-DD.' })
	@Matches(DATE)
	permitDate: string;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD; none = no expiry.' })
	@IsOptional()
	@Matches(DATE)
	validUntil?: string | null;
}

/** Permit details and on / off; the range only while no number was taken. */
@InputType()
export class UpdateInvoiceSeriesInput {
	@Field(() => ID)
	@IsUUID()
	id: string;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(60)
	permitNo?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@Matches(DATE)
	permitDate?: string | null;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD; send an empty string to clear it.' })
	@IsOptional()
	@IsString()
	validUntil?: string | null;

	@Field(() => Boolean, { nullable: true })
	@IsOptional()
	@IsBoolean()
	isActive?: boolean | null;
}
