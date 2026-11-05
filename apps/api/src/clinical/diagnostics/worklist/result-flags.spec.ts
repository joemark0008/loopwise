import { describe, expect, it } from 'vitest';

import { ResultUrgency } from '../models/diagnostic-enums.js';
import {
	flagFor,
	type FlaggableParameter,
	formatReferenceRange,
	parseNumericValue,
	urgencyOf,
	worstFlag,
} from './result-flags.js';

const numeric = (overrides: Partial<FlaggableParameter> = {}): FlaggableParameter => ({
	name: 'Hemoglobin',
	valueType: 'NUMERIC',
	options: [],
	refLowMale: 13.5,
	refHighMale: 17.5,
	refLowFemale: 12,
	refHighFemale: 15.5,
	refRangeText: null,
	...overrides,
});

describe('result flags', () => {
	it("flags a numeric value against the patient's sex-specific range", () => {
		expect(flagFor(numeric(), 'FEMALE', '12.8')).toBe('NORMAL');
		expect(flagFor(numeric(), 'MALE', '12.8')).toBe('LOW');
		expect(flagFor(numeric(), 'FEMALE', '16')).toBe('HIGH');
		expect(flagFor(numeric(), 'MALE', '17.5')).toBe('NORMAL');
	});

	it('turns an out-of-range value critical when the lab calls it in', () => {
		expect(flagFor(numeric(), 'MALE', '6.1', true)).toBe('CRITICAL_LOW');
		expect(flagFor(numeric(), 'MALE', '21', true)).toBe('CRITICAL_HIGH');
		expect(flagFor(numeric(), 'MALE', '15', true)).toBe('NORMAL');
	});

	it('flags against a one-sided range (HbA1c upper limit only)', () => {
		const hba1c = numeric({ refLowMale: null, refLowFemale: null, refHighMale: 5.6, refHighFemale: 5.6 });
		expect(flagFor(hba1c, 'FEMALE', '7.2')).toBe('HIGH');
		expect(flagFor(hba1c, 'FEMALE', '5.4')).toBe('NORMAL');
		expect(formatReferenceRange(hba1c, 'FEMALE')).toBe('< 5.6');
	});

	it('leaves free text, unparseable numbers and range-less analytes unflagged', () => {
		expect(flagFor(numeric({ valueType: 'TEXT' }), 'MALE', 'clear')).toBeNull();
		expect(flagFor(numeric(), 'MALE', '<5')).toBeNull();
		expect(
			flagFor(
				numeric({ refLowMale: null, refHighMale: null, refLowFemale: null, refHighFemale: null }),
				'MALE',
				'4',
			),
		).toBeNull();
	});

	it("flags an option against the normal answer (urinalysis protein 'Negative')", () => {
		const protein = numeric({
			valueType: 'OPTION',
			options: ['Negative', 'Trace', '1+', '2+'],
			refRangeText: 'Negative',
		});
		expect(flagFor(protein, 'FEMALE', 'negative')).toBe('NORMAL');
		expect(flagFor(protein, 'FEMALE', '2+')).toBe('ABNORMAL');
	});

	it('prints the range as the lab report does', () => {
		expect(formatReferenceRange(numeric(), 'FEMALE')).toBe('12–15.5');
		expect(formatReferenceRange(numeric({ refHighFemale: null }), 'FEMALE')).toBe('≥ 12');
		expect(
			formatReferenceRange(
				numeric({
					refLowFemale: null,
					refHighFemale: null,
					refRangeText: 'Negative',
				}),
				'FEMALE',
			),
		).toBe('Negative');
	});

	it('parses only plain numbers', () => {
		expect(parseNumericValue(' 131 ')).toBe(131);
		expect(parseNumericValue('7.2')).toBe(7.2);
		expect(parseNumericValue('.5')).toBe(0.5);
		expect(parseNumericValue('7,2')).toBeNull();
		expect(parseNumericValue('')).toBeNull();
	});

	it('ranks a result by its worst value', () => {
		expect(urgencyOf(['NORMAL', 'CRITICAL_HIGH', 'HIGH'])).toBe(ResultUrgency.CRITICAL);
		expect(urgencyOf(['NORMAL', 'LOW'])).toBe(ResultUrgency.ABNORMAL);
		expect(urgencyOf(['NORMAL', 'NORMAL'])).toBe(ResultUrgency.NORMAL);
		expect(urgencyOf(['NORMAL', null])).toBe(ResultUrgency.UNFLAGGED);
		expect(urgencyOf([])).toBe(ResultUrgency.UNFLAGGED);
		expect(worstFlag(['NORMAL', 'LOW', 'HIGH'])).toBe('HIGH');
		expect(worstFlag([null])).toBeNull();
	});
});
