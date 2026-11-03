import { describe, expect, it, vi } from 'vitest';

import type { ToolContext } from '../types/tools.js';
import chartPatientTrend from './chart-patient-trend.js';

const output = (rows: Record<string, number | string>[]) => ({
	_version: '1' as const,
	measure: 'blood_pressure' as const,
	patient: { id: 'p1', name: 'Maria Santos' },
	months: 12,
	asOf: '2026-11-03T00:00:00.000Z',
	chart: {
		title: 'Blood pressure',
		chartType: 'line' as const,
		xAxisKey: 'date',
		unit: 'mmHg',
		rows,
		series: [
			{ data_key: 'systolic', label: 'Systolic' },
			{ data_key: 'diastolic', label: 'Diastolic' },
		],
	},
});

const run = (
	input: Parameters<NonNullable<typeof chartPatientTrend.execute>>[0],
	result: unknown,
	chartPatientId?: string,
) => {
	const patientTrend = vi.fn().mockResolvedValue(result);
	const context = { userId: 'u', patientId: chartPatientId, services: { insights: { patientTrend } } };
	const promise = chartPatientTrend.execute!(input, {
		experimental_context: context as unknown as ToolContext,
		toolCallId: 't',
		messages: [],
	}) as Promise<unknown>;
	return { promise, patientTrend };
};

describe('chart_patient_trend tool', () => {
	it("charts the chart chat's patient when no id is given", async () => {
		const chart = output([{ date: '2026-10-22', systolic: 140, diastolic: 90 }]);
		const { promise, patientTrend } = run({ measure: 'blood_pressure' }, chart, 'p1');
		expect(await promise).toBe(chart);
		expect(patientTrend).toHaveBeenCalledWith('u', 'p1', 'blood_pressure', undefined);
	});

	it('asks for a patient outside a chart chat', async () => {
		const { promise, patientTrend } = run({ measure: 'hba1c' }, null);
		await expect(promise).rejects.toThrow(/Which patient\? Use find_patient/);
		expect(patientTrend).not.toHaveBeenCalled();
	});

	it('refuses a patient the user may not see', async () => {
		const { promise } = run({ measure: 'hba1c', patientId: 'p9' }, null);
		await expect(promise).rejects.toThrow(/Patient not found/);
	});

	it('tells the model the actual points, and only the extremes of a long series', () => {
		const toModel = chartPatientTrend.toModelOutput!;
		const short = toModel({
			toolCallId: 't',
			input: { measure: 'blood_pressure' },
			output: output([
				{ date: '2026-07-24', systolic: 138, diastolic: 88 },
				{ date: '2026-10-22', systolic: 140, diastolic: 90 },
			]),
		}) as { value: string };
		expect(short.value).toContain('2026-07-24: Systolic 138, Diastolic 88\n2026-10-22: Systolic 140, Diastolic 90');

		const rows = Array.from({ length: 30 }, (_, index) => ({
			date: `d${index}`,
			systolic: 120 + index,
			diastolic: 80,
		}));
		const long = toModel({ toolCallId: 't', input: { measure: 'blood_pressure' }, output: output(rows) }) as {
			value: string;
		};
		expect(long.value).toContain('30 points; showing first, last, lowest and highest Systolic:');
		expect(long.value.split('\n')).toHaveLength(7);
		expect(long.value).toContain('Result id: t (embed it in a report with <chart ref="t"/>).');
	});

	it('says so when there is nothing to chart', () => {
		const empty = chartPatientTrend.toModelOutput!({
			toolCallId: 't',
			input: { measure: 'blood_pressure' },
			output: output([]),
		}) as { value: string };
		expect(empty.value).toMatch(
			/^No Blood pressure recorded for Maria Santos in the last 12 months\. An empty chart is shown\.\nResult id: t /,
		);
	});
});
