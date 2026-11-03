import { proposeAllergy, proposeOrder, proposeVitals } from '@quarry/shared/wise-actions';
import { describe, expect, it } from 'vitest';

import type { ToolContext } from '../types/tools.js';
import { createActionTool } from './action-tool.js';

const run = (tool: unknown, input: unknown, context: Partial<ToolContext>) =>
	(tool as { execute: (input: unknown, options: unknown) => Promise<unknown> }).execute(input, {
		experimental_context: context,
		toolCallId: 't',
		messages: [],
	});

describe('createActionTool', () => {
	const chart = { patientId: 'p1' };

	it('names the patient and the record the card is about, and writes nothing', async () => {
		expect(await run(createActionTool(proposeVitals), { encounterId: ' e1 ', vitals: {} }, chart)).toEqual({
			_version: '1',
			success: true,
			patientId: 'p1',
			subjectId: 'e1',
		});
		expect(await run(createActionTool(proposeAllergy), { substance: 'Penicillin' }, chart)).toEqual({
			_version: '1',
			success: true,
			patientId: 'p1',
		});
	});

	it('works only in a chart chat, on a named record', async () => {
		await expect(run(createActionTool(proposeVitals), { encounterId: 'e1' }, {})).rejects.toThrow(
			/isn't about a patient/,
		);
		await expect(run(createActionTool(proposeVitals), { encounterId: ' ' }, chart)).rejects.toThrow(
			/Name the encounter/,
		);
	});

	it('resolves the tests the clinician named, and sends unknown ones back with the list', async () => {
		const output = await run(
			createActionTool(proposeOrder),
			{ encounterId: 'e1', tests: ['HbA1c', 'fbs', 'Hemoglobin A1c'] },
			chart,
		);
		expect(output).toMatchObject({
			tests: [
				{ code: '4548-4', display: 'Hemoglobin A1c' },
				{ code: '1558-6', display: 'Fasting glucose' },
			],
		});
		await expect(
			run(createActionTool(proposeOrder), { encounterId: 'e1', tests: ['HbA1c', 'Thyroid panel'] }, chart),
		).rejects.toThrow(/Not an orderable test: Thyroid panel.*Lipid panel/);
	});
});
