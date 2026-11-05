import { describe, expect, it, vi } from 'vitest';

import type { ToolContext } from '../types/tools.js';
import proposeEncounter from './propose-encounter.js';

const run = (
	patientId: string | undefined,
	clinics = [{ id: 'c1', name: 'Health Center', code: 'TAG', organizationId: 'o1', cityMunicipalityCode: null }],
) => {
	const context = {
		userId: 'u',
		patientId,
		services: { patients: { myCareClinics: vi.fn().mockResolvedValue(clinics) } },
	} as unknown as ToolContext;
	return proposeEncounter.execute!(
		{ reason: 'BP check' },
		{ experimental_context: context, toolCallId: 't', messages: [] },
	);
};

describe('propose_encounter tool', () => {
	it("returns the chat's patient and the user's clinics, and writes nothing", async () => {
		expect(await run('p1')).toEqual({
			_version: '1',
			success: true,
			patientId: 'p1',
			clinics: [{ id: 'c1', name: 'Health Center' }],
		});
	});

	it("refuses outside a patient's chart chat", async () => {
		await expect(run(undefined)).rejects.toThrow(/open the patient's chart/);
	});

	it('refuses for a user without a clinic', async () => {
		await expect(run('p1', [])).rejects.toThrow(/clinic/);
	});
});
