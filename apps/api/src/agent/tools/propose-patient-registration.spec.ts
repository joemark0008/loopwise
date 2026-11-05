import { describe, expect, it, vi } from 'vitest';

import type { ToolContext } from '../types/tools.js';
import proposePatientRegistration from './propose-patient-registration.js';

const run = async (
	input: Record<string, unknown>,
	clinics = [{ id: 'c1', name: 'Health Center', code: 'TAG', organizationId: 'o1', cityMunicipalityCode: null }],
) => {
	const patients = {
		myCareClinics: vi.fn().mockResolvedValue(clinics),
		checkDuplicates: vi.fn().mockResolvedValue([{ patientId: 'p1' }]),
	};
	const context = { userId: 'u', services: { patients } } as unknown as ToolContext;
	const output = await proposePatientRegistration.execute!(input as never, {
		experimental_context: context,
		toolCallId: 't',
		messages: [],
	});
	return { output, patients };
};

describe('propose_patient_registration tool', () => {
	it("checks duplicates in the first clinic's organization once the draft is complete, and writes nothing", async () => {
		const { output, patients } = await run({
			givenName: 'Juan',
			familyName: 'Dela Cruz',
			birthDate: '1980-05-02',
			sex: 'MALE',
		});
		expect(patients.checkDuplicates).toHaveBeenCalledWith('u', expect.objectContaining({ clinicId: 'c1' }));
		expect(output).toEqual({
			_version: '1',
			success: true,
			clinics: [{ id: 'c1', name: 'Health Center' }],
			duplicates: [{ patientId: 'p1' }],
		});
	});

	it('skips the duplicate check for an incomplete draft', async () => {
		const { output, patients } = await run({ givenName: 'Juan', familyName: 'Dela Cruz' });
		expect(patients.checkDuplicates).not.toHaveBeenCalled();
		expect(output).toMatchObject({ duplicates: [] });
	});

	it('fails for a user without a clinic', async () => {
		await expect(run({ givenName: 'Juan', familyName: 'Cruz' }, [])).rejects.toThrow(/clinic/);
	});

	it('tells the model to stop and wait, and about an existing registration', () => {
		const modelOutput = (duplicates: object[]) =>
			proposePatientRegistration.toModelOutput?.({
				toolCallId: 't',
				input: {} as never,
				output: { success: true, clinics: [], duplicates } as never,
			});
		expect(modelOutput([])).toEqual({ type: 'text', value: expect.stringMatching(/Stop and wait/) });
		expect(modelOutput([{ match: 'EXACT_IDENTIFIER' }])).toEqual({
			type: 'text',
			value: expect.stringMatching(/do not suggest registering again/),
		});
	});
});
