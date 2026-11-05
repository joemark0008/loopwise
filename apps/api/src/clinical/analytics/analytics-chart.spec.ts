import { describe, expect, it } from 'vitest';

import { checkChart, thresholdReferences } from './analytics.service.js';

const columns = ['age_band', 'patients', 'label'];
const rows = [
	['40-59', 4, 'a'],
	['60+', '<5', 'b'],
];

describe('analytics result charts', () => {
	it('draws only columns the result returned', () => {
		expect(checkChart({ type: 'bar', x: 'age_band', y: ['patients'] }, columns, rows)).toEqual({
			type: 'bar',
			x: 'age_band',
			y: ['patients'],
		});
		expect(() => checkChart({ type: 'bar', x: 'age_band', y: ['visits'] }, columns, rows)).toThrow(
			/Chart columns visits are not in the result/,
		);
	});

	it('refuses a non-numeric y column, but takes suppressed "<5" cells', () => {
		expect(() => checkChart({ type: 'line', x: 'age_band', y: ['label'] }, columns, rows)).toThrow(/not numeric/);
	});

	it('gives a pie exactly one y column', () => {
		expect(() => checkChart({ type: 'pie', x: 'age_band', y: ['patients', 'patients'] }, columns, rows)).toThrow(
			/exactly one y column/,
		);
	});
});

describe('chart thresholds', () => {
	it('draws the fixed HbA1c cut-offs as lines and shaded ranges', () => {
		expect(thresholdReferences(['4548-4'])).toEqual([
			{ label: 'HbA1c 5.7 %', axis: 'y', value: 5.7, tone: 'actionable' },
			{ label: 'Prediabetes range', axis: 'y', from: 5.7, to: 6.5, tone: 'actionable' },
			{ label: 'HbA1c 6.5 %', axis: 'y', value: 6.5, tone: 'actionable' },
			{ label: 'Diabetes range', axis: 'y', from: 6.5, tone: 'actionable' },
		]);
	});

	it('draws fasting glucose at 100 and 126 mg/dL, BP at 140/90, and nothing for an unknown key', () => {
		const values = (keys: string[]) =>
			thresholdReferences(keys)
				.map((reference) => reference.value)
				.filter((value) => value !== undefined);
		expect(values(['1558-6'])).toEqual([100, 126]);
		expect(values(['bp', '9999-9'])).toEqual([140, 90]);
	});

	it('never keeps references the model sent', () => {
		const chart = {
			type: 'bar',
			x: 'age_band',
			y: ['patients'],
			references: [{ label: 'x', axis: 'y', value: 99 }],
		};
		expect(checkChart(chart as never, columns, rows)).not.toHaveProperty('references');
	});
});
