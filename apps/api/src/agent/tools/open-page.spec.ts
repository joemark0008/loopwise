import { describe, expect, it, vi } from 'vitest';

import type { ToolContext } from '../types/tools.js';
import openPage from './open-page.js';

const PATIENT_ID = '334d301e-8bec-4e38-b6f0-ee218b3e21b0';

const run = (
	input: Parameters<NonNullable<typeof openPage.execute>>[0],
	patient: object | null = null,
	chartPatientId?: string,
) => {
	const getById = vi.fn().mockResolvedValue(patient);
	const context = {
		userId: 'u',
		patientId: chartPatientId,
		services: { patients: { getById } },
	} as unknown as ToolContext;
	const result = openPage.execute!(input, { experimental_context: context, toolCallId: 't', messages: [] });
	return { result: result as Promise<unknown>, getById };
};

describe('open_page tool', () => {
	it("opens a patient's chart the user may see, named after them", async () => {
		const { result, getById } = run(
			{ page: 'patients.detail', params: { patientId: PATIENT_ID }, userAskedToOpen: true },
			{ givenName: 'Maria', familyName: 'Santos' },
		);
		expect(await result).toEqual({
			_version: '1',
			key: 'patients.detail',
			params: { patientId: PATIENT_ID },
			label: "Maria Santos's chart",
			autoNavigate: true,
		});
		expect(getById).toHaveBeenCalledWith('u', PATIENT_ID, 'Wise open_page');
	});

	it('refuses a patient the user may not see', async () => {
		const { result } = run({ page: 'patients.detail', params: { patientId: PATIENT_ID }, userAskedToOpen: true });
		await expect(result).rejects.toThrow(/No patient the user may see/);
	});

	it("checks access to a patient's other pages too", async () => {
		const { result, getById } = run(
			{ page: 'patients.results', params: { patientId: PATIENT_ID }, userAskedToOpen: false },
			{ givenName: 'Maria', familyName: 'Santos' },
		);
		expect(await result).toMatchObject({ key: 'patients.results', label: "Patient's results (Maria Santos)" });
		expect(getById).toHaveBeenCalledWith('u', PATIENT_ID, 'Wise open_page');
		const refused = run({ page: 'patients.detail', params: { patientId: PATIENT_ID }, userAskedToOpen: false });
		await expect(refused.result).rejects.toThrow(/No patient the user may see/);
	});

	it('refuses an id that is not one (an invented one)', async () => {
		const { result, getById } = run({
			page: 'patients.detail',
			params: { patientId: 'maria-santos' },
			userAskedToOpen: false,
		});
		await expect(result).rejects.toThrow(/Wrong params for patients.detail/);
		expect(getById).not.toHaveBeenCalled();
	});

	it('opens a page without params and checks no patient', async () => {
		const { result, getById } = run({ page: 'patients.new', userAskedToOpen: false });
		expect(await result).toEqual({
			_version: '1',
			key: 'patients.new',
			params: {},
			label: 'Register a patient',
			autoNavigate: false,
		});
		expect(getById).not.toHaveBeenCalled();
	});

	it("only offers the link from a patient's chart chat", async () => {
		const { result } = run({ page: 'patients.list', userAskedToOpen: true }, null, PATIENT_ID);
		expect(await result).toMatchObject({ key: 'patients.list', autoNavigate: false });
	});

	it('rejects params a page does not take', async () => {
		const { result } = run({ page: 'patients.list', params: { patientId: PATIENT_ID }, userAskedToOpen: false });
		await expect(result).rejects.toThrow(/Wrong params/);
	});

	it('tells the model to stop after an automatic navigation', () => {
		const toModelOutput = openPage.toModelOutput!;
		const output = { key: 'patients.list', params: {}, label: 'Patients' } as const;
		expect(
			toModelOutput({ toolCallId: 't', input: {} as never, output: { ...output, autoNavigate: true } }),
		).toEqual({ type: 'text', value: 'Opening Patients for the user. Do not call more tools; end your turn.' });
		expect(
			toModelOutput({ toolCallId: 't', input: {} as never, output: { ...output, autoNavigate: false } }),
		).toEqual({ type: 'text', value: 'Link to Patients shown to the user.' });
	});
});
