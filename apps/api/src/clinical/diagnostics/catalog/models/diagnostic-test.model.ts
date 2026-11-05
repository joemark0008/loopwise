import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

import type { Prisma } from '../../../../generated/prisma/client.js';
import { DiagnosticCategory, ResultValueType } from '../../models/diagnostic-enums.js';

@ObjectType({ description: 'An analyte of a test (CBC → Hgb, Hct, WBC …), with its reference range by sex.' })
export class DiagnosticTestParameter {
	@Field(() => ID)
	id: string;

	@Field()
	code: string;

	@Field()
	name: string;

	@Field(() => String, { nullable: true })
	unit: string | null;

	@Field(() => ResultValueType)
	valueType: ResultValueType;

	@Field(() => [String], { description: 'The answers of an OPTION analyte.' })
	options: string[];

	@Field(() => Float, { nullable: true })
	refLowMale: number | null;

	@Field(() => Float, { nullable: true })
	refHighMale: number | null;

	@Field(() => Float, { nullable: true })
	refLowFemale: number | null;

	@Field(() => Float, { nullable: true })
	refHighFemale: number | null;

	@Field(() => String, { nullable: true, description: 'The range when it is not numeric, e.g. "Negative".' })
	refRangeText: string | null;

	@Field(() => String, { nullable: true, description: 'LOINC of the analyte (`lis_code`).' })
	loincCode: string | null;

	@Field(() => Int)
	sortOrder: number;
}

@ObjectType({ description: "A test of the organization's catalog: CBC, FBS, lipid profile, chest X-ray PA …" })
export class DiagnosticTest {
	@Field(() => ID)
	id: string;

	@Field({ description: 'The catalog code, unique per organization, e.g. `HBA1C`.' })
	code: string;

	@Field()
	name: string;

	@Field(() => DiagnosticCategory)
	category: DiagnosticCategory;

	@Field(() => String, { nullable: true, description: 'Hematology, Clinical Chemistry, X-Ray …' })
	section: string | null;

	@Field(() => String, { nullable: true })
	specimenType: string | null;

	@Field()
	requiresFasting: boolean;

	@Field(() => Int, { nullable: true })
	turnaroundHours: number | null;

	@Field(() => String, { nullable: true, description: 'LOINC of the test (`lis_code`).' })
	loincCode: string | null;

	@Field()
	isActive: boolean;

	@Field(() => [DiagnosticTestParameter], { description: 'In report order.' })
	parameters: DiagnosticTestParameter[];
}

export type DiagnosticTestRow = Prisma.DiagnosticTestGetPayload<{ include: { parameters: true } }>;
export type DiagnosticTestParameterRow = DiagnosticTestRow['parameters'][number];

const toNumber = (value: Prisma.Decimal | null): number | null => (value === null ? null : Number(value));

export function toDiagnosticTestParameter(row: DiagnosticTestParameterRow): DiagnosticTestParameter {
	return {
		id: row.id,
		code: row.code,
		name: row.name,
		unit: row.unit,
		valueType: row.valueType,
		options: row.options,
		refLowMale: toNumber(row.refLowMale),
		refHighMale: toNumber(row.refHighMale),
		refLowFemale: toNumber(row.refLowFemale),
		refHighFemale: toNumber(row.refHighFemale),
		refRangeText: row.refRangeText,
		loincCode: row.lisCode,
		sortOrder: row.sortOrder,
	};
}

export function toDiagnosticTest(row: DiagnosticTestRow): DiagnosticTest {
	return {
		id: row.id,
		code: row.code,
		name: row.name,
		category: row.category,
		section: row.section,
		specimenType: row.specimenType,
		requiresFasting: row.requiresFasting,
		turnaroundHours: row.turnaroundHours,
		loincCode: row.lisCode,
		isActive: row.isActive,
		parameters: [...row.parameters].sort((a, b) => a.sortOrder - b.sortOrder).map(toDiagnosticTestParameter),
	};
}
