import type { PathwayDefinition } from '@quarry/shared/pathway-rules';
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
	const pathway = {
		rules: {
			triggers: [
				{
					type: 'numeric',
					code: '4548-4',
					display: 'HbA1c',
					unit: '%',
					bands: [
						{ below: 5.7, classification: 'normal', reason: 'Normal' },
						{ min: 5.7, below: 6.5, classification: 'actionable', reason: 'Prediabetes range' },
						{ min: 6.5, classification: 'actionable', reason: 'Diabetes range' },
					],
				},
			],
		},
	} as unknown as PathwayDefinition;

	it("draws a pathway's bands as lines where they start and shaded actionable ranges", () => {
		expect(thresholdReferences(['4548-4'], [pathway])).toEqual([
			{ label: 'HbA1c 5.7 % (actionable)', axis: 'y', value: 5.7, tone: 'actionable' },
			{ label: 'Prediabetes range', axis: 'y', from: 5.7, to: 6.5, tone: 'actionable' },
			{ label: 'HbA1c 6.5 % (actionable)', axis: 'y', value: 6.5, tone: 'actionable' },
			{ label: 'Diabetes range', axis: 'y', from: 6.5, to: undefined, tone: 'actionable' },
		]);
	});

	it('draws the fixed BP cut-offs, and nothing for a code no pathway has', () => {
		expect(thresholdReferences(['bp', '9999-9'], [pathway]).map((reference) => reference.value)).toEqual([140, 90]);
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
