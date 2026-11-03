import { describe, expect, it, vi } from 'vitest';

import type { ToolContext } from '../types/tools.js';
import findPatient from './find-patient.js';

const maria = {
	id: 'p1',
	givenName: 'Maria',
	familyName: 'Santos',
	birthDate: '1972-03-14',
	sex: 'female' as const,
	identifiers: [{ system: 'MRN', value: 'TAG-0001', orgId: 'hc' }],
};

const run = (input: { query?: string; birthDate?: string }, found = { patients: [maria], truncated: false }) => {
	const findForWise = vi.fn().mockResolvedValue(found);
	const context = { userId: 'u', services: { patients: { findForWise } } } as unknown as ToolContext;
	const result = findPatient.execute!(input, { experimental_context: context, toolCallId: 't', messages: [] });
	return { result, findForWise };
};

describe('find_patient tool', () => {
	it('searches as the user and returns the matches with their ids', async () => {
		const { result, findForWise } = run({ query: ' Maria Santos ' });
		expect(await result).toEqual({
			_version: '1',
			patients: [
				{
					id: 'p1',
					name: 'Maria Santos',
					birthDate: '1972-03-14',
					sex: 'female',
					identifiers: [{ system: 'MRN', value: 'TAG-0001' }],
				},
			],
			truncated: false,
		});
		expect(findForWise).toHaveBeenCalledWith('u', { query: 'Maria Santos', birthDate: undefined }, 10);
	});

	it('passes a birth date alone', async () => {
		const { result, findForWise } = run({ birthDate: '1972-03-14' });
		await result;
		expect(findForWise).toHaveBeenCalledWith('u', { query: undefined, birthDate: '1972-03-14' }, 10);
	});

	it('says when more patients matched', async () => {
		const { result } = run({ query: 'a' }, { patients: [maria], truncated: true });
		expect(await result).toMatchObject({ truncated: true });
	});

	it('refuses an empty search, which would list every patient', async () => {
		const { result, findForWise } = run({ query: '  ' });
		await expect(result).rejects.toThrow(/name, an identifier or a birth date/);
		expect(findForWise).not.toHaveBeenCalled();
	});
});
