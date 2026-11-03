import { describe, expect, it, vi } from 'vitest';

import type { ToolContext } from '../types/tools.js';
import proposeEncounterNote from './propose-encounter-note.js';

const draftBase = {
	encounter: { id: 'e1', startedAt: '2026-11-03T01:00:00.000Z', facilityName: 'Health Center' },
	patientName: 'Maria Santos',
	current: {
		reason: 'Fatigue',
		history: null,
		physicalExam: null,
		assessment: null,
		plan: 'Labs',
		patientInstructions: null,
		followUpOn: null,
		notes: null,
	},
	version: 3,
};

const run = (patientId: string | undefined, input: Record<string, unknown>, getNoteForWise = vi.fn()) => {
	const context = { userId: 'u', patientId, services: { encounters: { getNoteForWise } } } as unknown as ToolContext;
	return proposeEncounterNote.execute!(input as never, {
		experimental_context: context,
		toolCallId: 't',
		messages: [],
	});
};

describe('propose_encounter_note tool', () => {
	it("returns the note as it is and its version for the chat's patient, and writes nothing", async () => {
		const getNoteForWise = vi.fn().mockResolvedValue(draftBase);
		expect(await run('p1', { encounterId: 'e1', plan: 'Recheck BP' }, getNoteForWise)).toEqual({
			_version: '1',
			success: true,
			...draftBase,
		});
		expect(getNoteForWise).toHaveBeenCalledWith('u', 'p1', 'e1');
	});

	it('drafts against the latest encounter when no id is given', async () => {
		const getNoteForWise = vi.fn().mockResolvedValue(draftBase);
		await run('p1', { plan: 'Recheck BP' }, getNoteForWise);
		expect(getNoteForWise).toHaveBeenCalledWith('u', 'p1', undefined);
	});

	it("refuses outside a patient's chart chat", async () => {
		await expect(run(undefined, { plan: 'x' })).rejects.toThrow(/open the patient's chart/);
	});

	it('passes on a refusal to read the encounter (another patient, another facility)', async () => {
		const getNoteForWise = vi.fn().mockRejectedValue(new Error('This patient has no such encounter.'));
		await expect(run('p1', { encounterId: 'other', plan: 'x' }, getNoteForWise)).rejects.toThrow(
			/no such encounter/,
		);
	});

	it('tells the model nothing is saved yet', () => {
		const output = proposeEncounterNote.toModelOutput!({
			toolCallId: 't',
			input: {},
			output: { ...draftBase, success: true },
		});
		expect(JSON.stringify(output)).toMatch(/Nothing is saved yet/);
	});
});
