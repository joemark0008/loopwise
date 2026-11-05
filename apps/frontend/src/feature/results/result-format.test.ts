import { describe, expect, it } from 'vitest';

import { referenceRange, resultSummary, valueText } from './result-format';

const value = (name: string, val: string, unit: string | null, flag: string | null, range: string | null = null) => ({
	id: name,
	name,
	value: val,
	unit,
	referenceRange: range,
	flag: flag as never,
});

describe('result format', () => {
	it('shows a one-analyte result as its value with its range', () => {
		const report = { values: [value('HbA1c', '7.2', '%', 'HIGH', '4–5.6')], findings: null, impression: null };
		expect(resultSummary(report)).toBe('7.2 %');
		expect(referenceRange(report)).toBe('4–5.6');
	});

	it("shows a panel's out-of-range analytes, or that all are within range", () => {
		const cbc = {
			values: [value('Hemoglobin', '11.2', 'g/dL', 'LOW'), value('Platelets', '250', '×10⁹/L', 'NORMAL')],
			findings: null,
			impression: null,
		};
		expect(resultSummary(cbc)).toBe('Hemoglobin 11.2 g/dL');
		expect(referenceRange(cbc)).toBeNull();
		expect(resultSummary({ ...cbc, values: [cbc.values[1], cbc.values[1]] })).toBe('All within range');
	});

	it("shows an imaging report's impression", () => {
		expect(resultSummary({ values: [], findings: 'Clear lung fields.', impression: 'Normal chest' })).toBe(
			'Normal chest',
		);
		expect(valueText({ value: 'Negative', unit: null })).toBe('Negative');
	});
});
