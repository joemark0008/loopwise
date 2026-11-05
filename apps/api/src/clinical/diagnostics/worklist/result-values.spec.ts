import { describe, expect, it } from 'vitest';

import { Prisma } from '../../../generated/prisma/client.js';
import type { DiagnosticTestParameterRow } from '../catalog/models/diagnostic-test.model.js';
import {
	InvalidCriticalFlagError,
	InvalidResultValueError,
	UnknownResultParameterError,
} from '../diagnostics.errors.js';
import { buildResultValues } from './result-values.js';

const decimal = (value: number | null) => (value === null ? null : new Prisma.Decimal(value));

function parameter(
	id: string,
	overrides: Partial<
		Omit<DiagnosticTestParameterRow, 'refLowMale' | 'refHighMale' | 'refLowFemale' | 'refHighFemale'>
	> & {
		range?: [number | null, number | null, number | null, number | null];
	} = {},
): DiagnosticTestParameterRow {
	const [lowMale, highMale, lowFemale, highFemale] = overrides.range ?? [13.5, 17.5, 12, 15.5];
	return {
		id,
		testId: 'cbc',
		code: id.toUpperCase(),
		name: id,
		unit: 'g/dL',
		valueType: 'NUMERIC',
		options: [],
		refRangeText: null,
		lisCode: null,
		sortOrder: 0,
		...overrides,
		refLowMale: decimal(lowMale),
		refHighMale: decimal(highMale),
		refLowFemale: decimal(lowFemale),
		refHighFemale: decimal(highFemale),
	};
}

const hgb = parameter('hgb', { name: 'Hemoglobin' });
const protein = parameter('protein', {
	name: 'Protein',
	valueType: 'OPTION',
	options: ['Negative', 'Trace', '1+', '2+'],
	refRangeText: 'Negative',
	unit: null,
	range: [null, null, null, null],
});

describe('buildResultValues', () => {
	it("snapshots the parameter's name, unit and sex-specific range and computes the flag", () => {
		expect(buildResultValues([hgb, protein], 'FEMALE', [{ parameterId: 'hgb', value: ' 11.2 ' }])).toEqual([
			{
				parameterId: 'hgb',
				name: 'Hemoglobin',
				value: '11.2',
				numericValue: 11.2,
				unit: 'g/dL',
				referenceRange: '12–15.5',
				flag: 'LOW',
			},
		]);
	});

	it('normalises an option to its spelling and flags it against the normal answer', () => {
		expect(buildResultValues([protein], 'MALE', [{ parameterId: 'protein', value: 'negative' }])[0]).toMatchObject({
			value: 'Negative',
			flag: 'NORMAL',
			referenceRange: 'Negative',
		});
		expect(() => buildResultValues([protein], 'MALE', [{ parameterId: 'protein', value: '5+' }])).toThrow(
			InvalidResultValueError,
		);
	});

	it('skips blank values and keeps free analytes unflagged', () => {
		expect(
			buildResultValues([hgb], 'MALE', [
				{ parameterId: 'hgb', value: '  ' },
				{ name: 'Blood smear', value: 'Normocytic, normochromic' },
			]),
		).toEqual([
			{
				parameterId: null,
				name: 'Blood smear',
				value: 'Normocytic, normochromic',
				numericValue: null,
				unit: null,
				referenceRange: null,
				flag: null,
			},
		]);
	});

	it('refuses a non-number, an unknown or repeated parameter, and a critical call inside the range', () => {
		expect(() => buildResultValues([hgb], 'MALE', [{ parameterId: 'hgb', value: 'high' }])).toThrow(
			InvalidResultValueError,
		);
		expect(() => buildResultValues([hgb], 'MALE', [{ parameterId: 'nope', value: '1' }])).toThrow(
			UnknownResultParameterError,
		);
		expect(() =>
			buildResultValues([hgb], 'MALE', [
				{ parameterId: 'hgb', value: '14' },
				{ parameterId: 'hgb', value: '15' },
			]),
		).toThrow(UnknownResultParameterError);
		expect(() => buildResultValues([hgb], 'MALE', [{ parameterId: 'hgb', value: '14', critical: true }])).toThrow(
			InvalidCriticalFlagError,
		);
		expect(buildResultValues([hgb], 'MALE', [{ parameterId: 'hgb', value: '6.0', critical: true }])[0].flag).toBe(
			'CRITICAL_LOW',
		);
	});
});
