import { Field, Float, ID, ObjectType } from '@nestjs/graphql';

import { Sex } from '../../../generated/prisma/enums.js';
import type { PatientRow, PractitionerNameRow, ResultRow } from '../diagnostic.includes.js';
import { urgencyOf, worstFlag } from '../worklist/result-flags.js';
import { ResultFlag, ResultUrgency } from './diagnostic-enums.js';

@ObjectType({ description: 'The patient a test belongs to, as the lab desk and the results inbox show them.' })
export class DiagnosticPatient {
	@Field(() => ID)
	id: string;

	@Field({ description: 'The MRN / chart number.' })
	patientNo: string;

	@Field()
	firstName: string;

	@Field()
	lastName: string;

	@Field(() => String, { nullable: true })
	middleName: string | null;

	@Field({ description: '`YYYY-MM-DD`.' })
	birthDate: string;

	@Field(() => Sex)
	sex: Sex;
}

@ObjectType({ description: 'One analyte of a result, with the range and flag printed at the time.' })
export class DiagnosticResultValue {
	@Field(() => ID)
	id: string;

	@Field(() => ID, { nullable: true })
	parameterId: string | null;

	@Field()
	name: string;

	@Field({ description: 'As entered; the number is also in `numericValue`.' })
	value: string;

	@Field(() => Float, { nullable: true })
	numericValue: number | null;

	@Field(() => String, { nullable: true })
	unit: string | null;

	@Field(() => String, { nullable: true })
	referenceRange: string | null;

	@Field(() => ResultFlag, { nullable: true })
	flag: ResultFlag | null;

	@Field(() => String, { nullable: true, description: "LOINC of the analyte, else the test's." })
	loincCode: string | null;
}

@ObjectType({ description: 'The result of one ordered test: analyte values, or the findings of an imaging report.' })
export class DiagnosticResult {
	@Field(() => ID)
	id: string;

	@Field(() => [DiagnosticResultValue])
	values: DiagnosticResultValue[];

	@Field(() => String, { nullable: true, description: 'Imaging narrative.' })
	findings: string | null;

	@Field(() => String, { nullable: true })
	impression: string | null;

	@Field(() => String, { nullable: true })
	remarks: string | null;

	@Field(() => ResultFlag, { nullable: true, description: 'The worst flag of its values.' })
	flag: ResultFlag | null;

	@Field(() => ResultUrgency)
	urgency: ResultUrgency;

	@Field(() => Date, { nullable: true })
	resultedAt: Date | null;

	@Field(() => Date, { nullable: true, description: 'When the lab released it to the doctor.' })
	releasedAt: Date | null;

	@Field(() => Date, { nullable: true, description: 'When the doctor reviewed it in the results inbox.' })
	reviewedAt: Date | null;
}

export function toDiagnosticPatient(row: PatientRow): DiagnosticPatient {
	return {
		id: row.id,
		patientNo: row.patientNo,
		firstName: row.firstName,
		lastName: row.lastName,
		middleName: row.middleName,
		birthDate: row.birthDate.toISOString().slice(0, 10),
		sex: row.sex,
	};
}

/** `Dr. Ana Reyes`. */
export function practitionerName(row: Pick<PractitionerNameRow, 'title' | 'firstName' | 'lastName'>): string {
	return [row.title, row.firstName, row.lastName].filter(Boolean).join(' ');
}

/** The result with its values in report order (the parameters' order, free analytes last). */
export function toDiagnosticResult(row: ResultRow, testLoincCode: string | null): DiagnosticResult {
	const values = [...row.values]
		.sort(
			(a, b) =>
				(a.parameter?.sortOrder ?? Number.MAX_SAFE_INTEGER) -
					(b.parameter?.sortOrder ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name),
		)
		.map((value) => ({
			id: value.id,
			parameterId: value.parameterId,
			name: value.name,
			value: value.value,
			numericValue: value.numericValue === null ? null : Number(value.numericValue),
			unit: value.unit,
			referenceRange: value.referenceRange,
			flag: value.flag,
			loincCode: value.parameter?.lisCode ?? testLoincCode,
		}));
	const flags = values.map((value) => value.flag);
	return {
		id: row.id,
		values,
		findings: row.findings,
		impression: row.impression,
		remarks: row.remarks,
		flag: worstFlag(flags),
		urgency: values.length > 0 ? urgencyOf(flags) : ResultUrgency.UNFLAGGED,
		resultedAt: row.resultedAt,
		releasedAt: row.releasedAt,
		reviewedAt: row.reviewedAt,
	};
}
