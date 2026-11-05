import { Field, ID, InputType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsBoolean, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

import { trim } from '../../../../common/validators/auth-input.validators.js';
import { WiseOriginInput } from '../../../wise-proposals/dto/wise-origin.input.js';

@InputType({ description: 'The specimen of a test was taken.' })
export class MarkSpecimenCollectedInput {
	@Field(() => ID)
	@IsUUID()
	itemId: string;

	@Field(() => String, {
		nullable: true,
		description: 'The specimen label (barcode); default the order number and the test code.',
	})
	@IsOptional()
	@Transform(trim)
	@IsString()
	@MaxLength(60)
	accessionNo?: string | null;

	@Field(() => WiseOriginInput, { nullable: true, description: 'Set by a Wise card (`propose_lab_order_step`).' })
	@IsOptional()
	@ValidateNested()
	@Type(() => WiseOriginInput)
	wiseOrigin?: WiseOriginInput | null;
}

@InputType({ description: 'One analyte of a result as the medtech enters it.' })
export class DiagnosticResultValueInput {
	@Field(() => ID, { nullable: true, description: "One of the test's parameters; leave out for a free analyte." })
	@IsOptional()
	@IsUUID()
	parameterId?: string | null;

	@Field(() => String, { nullable: true, description: 'The name of a free analyte (no parameter).' })
	@IsOptional()
	@Transform(trim)
	@IsString()
	@MaxLength(120)
	name?: string | null;

	@Field({ description: 'As read; blank values are skipped.' })
	@Transform(trim)
	@IsString()
	@MaxLength(500)
	value: string;

	@Field(() => String, { nullable: true, description: 'Unit of a free analyte; a parameter uses its own.' })
	@IsOptional()
	@Transform(trim)
	@IsString()
	@MaxLength(30)
	unit?: string | null;

	@Field(() => Boolean, {
		nullable: true,
		description: 'The lab calls the value in as critical (only outside its reference range).',
	})
	@IsOptional()
	@IsBoolean()
	critical?: boolean | null;
}

@InputType({
	description:
		'The result of one test: analyte values (laboratory) or findings and impression (imaging). Entering it again ' +
		'before release replaces it; after release it is a correction that needs releasing again.',
})
export class EnterDiagnosticResultInput {
	@Field(() => ID)
	@IsUUID()
	itemId: string;

	@Field(() => [DiagnosticResultValueInput], { defaultValue: [] })
	@ArrayMaxSize(100)
	@ValidateNested({ each: true })
	@Type(() => DiagnosticResultValueInput)
	values: DiagnosticResultValueInput[];

	@Field(() => String, { nullable: true })
	@IsOptional()
	@Transform(trim)
	@IsString()
	@MaxLength(10_000)
	findings?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@Transform(trim)
	@IsString()
	@MaxLength(2000)
	impression?: string | null;

	@Field(() => String, { nullable: true, description: 'For a correction: what changed and why.' })
	@IsOptional()
	@Transform(trim)
	@IsString()
	@MaxLength(2000)
	remarks?: string | null;
}

@InputType({ description: 'A lab step on one test (start the run, release the result).' })
export class DiagnosticItemStepInput {
	@Field(() => ID)
	@IsUUID()
	itemId: string;

	@Field(() => WiseOriginInput, { nullable: true, description: 'Set by a Wise card (`propose_lab_order_step`).' })
	@IsOptional()
	@ValidateNested()
	@Type(() => WiseOriginInput)
	wiseOrigin?: WiseOriginInput | null;
}
