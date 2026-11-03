import { describe, expect, it, vi } from 'vitest';

import type { ToolContext } from '../types/tools.js';
import proposeEncounter from './propose-encounter.js';

const run = (patientId: string | undefined, facilities = [{ id: 'hc', name: 'Health Center', slug: 'hc' }]) => {
	const context = {
		userId: 'u',
		patientId,
		services: { patients: { myFacilities: vi.fn().mockResolvedValue(facilities) } },
	} as unknown as ToolContext;
	return proposeEncounter.execute!(
		{ reason: 'BP check' },
		{ experimental_context: context, toolCallId: 't', messages: [] },
	);
};

describe('propose_encounter tool', () => {
	it("returns the chat's patient and the user's facilities, and writes nothing", async () => {
		expect(await run('p1')).toEqual({
			_version: '1',
			success: true,
			patientId: 'p1',
			facilities: [{ id: 'hc', name: 'Health Center' }],
		});
	});

	it("refuses outside a patient's chart chat", async () => {
		await expect(run(undefined)).rejects.toThrow(/open the patient's chart/);
	});

	it('refuses for a user without a facility', async () => {
		await expect(run('p1', [])).rejects.toThrow(/facility/);
	});
});
