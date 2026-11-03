import { describe, expect, it, vi } from 'vitest';

import type { ToolContext } from '../types/tools.js';
import createReport from './create-report.js';

const snapshot = {
	type: 'patient_summary' as const,
	title: 'Patient clinical summary',
	subject: 'Maria Santos · F · 45 y',
	patientId: 'p1',
	facility: null,
	generatedAt: '2026-11-03T00:00:00.000Z',
	generatedBy: 'Dr. Reyes',
	months: 12,
	sections: [],
};

const run = (input: Parameters<NonNullable<typeof createReport.execute>>[0], chartPatientId?: string) => {
	const buildReport = vi.fn().mockResolvedValue(snapshot);
	const context = { userId: 'u', patientId: chartPatientId, services: { insights: { buildReport } } };
	const promise = createReport.execute!(input, {
		experimental_context: context as unknown as ToolContext,
		toolCallId: 'call_1',
		messages: [],
	}) as Promise<unknown>;
	return { promise, buildReport };
};

describe('create_report tool', () => {
	it("builds the report of the chart chat's patient, with the call id as the report id", async () => {
		const { promise, buildReport } = run(
			{ type: 'patient_summary', narrative: '  BP is above target.  ', charts: ['blood_pressure'] },
			'p1',
		);
		expect(await promise).toEqual({ _version: '1', snapshot, narrative: 'BP is above target.' });
		expect(buildReport).toHaveBeenCalledWith('u', {
			type: 'patient_summary',
			patientId: 'p1',
			encounterId: undefined,
			facilityId: undefined,
			months: undefined,
			charts: ['blood_pressure'],
			narrative: 'BP is above target.',
			reportId: 'call_1',
		});
	});

	it('passes an explicit patient over the chart chat one', async () => {
		const { promise, buildReport } = run({ type: 'patient_summary', patientId: 'p2', narrative: 'Stable.' }, 'p1');
		await promise;
		expect(buildReport.mock.calls[0][1]).toMatchObject({ patientId: 'p2' });
	});

	it('tells the model the report is only shown, never saved or sent', () => {
		const model = createReport.toModelOutput!({
			toolCallId: 'call_1',
			input: { type: 'patient_summary', narrative: 'Stable.' },
			output: { _version: '1', snapshot, narrative: 'Stable.' },
		}) as { value: string };
		expect(model.value).toMatch(/shown to the clinician with a Download PDF button\. Nothing is saved or sent\./);
	});
});
