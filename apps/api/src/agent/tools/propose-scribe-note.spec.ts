import { scribeDemoDraft } from '@loopwise/shared/scribe-demo';
import { proposeScribeNote } from '@loopwise/shared/tools';
import { describe, expect, it, vi } from 'vitest';

import type { ToolContext } from '../types/tools.js';
import proposeScribeNoteTool from './propose-scribe-note.js';

const resolved = {
	patientId: 'p1',
	encounter: {
		id: 'e1',
		encounterNo: 'TAG-ENC-2026-000042',
		startedAt: '2026-11-06T01:00:00.000Z',
		clinicName: 'HC',
	},
	parts: proposeScribeNote.draftParts(scribeDemoDraft('e1')),
	diagnoses: [
		{ icd10Code: 'I10', known: true, title: 'Essential (primary) hypertension' },
		{ icd10Code: 'E11.9', known: true, title: 'Non-insulin-dependent diabetes mellitus without complications' },
	],
	tests: {
		matched: [{ testId: 't1', code: 'HBA1C', name: 'HbA1c', category: 'LABORATORY' }],
		unmatched: ['serum creatinine'],
	},
	allergies: [{ allergen: 'Penicillin', severity: 'SEVERE' }],
	allergyWarnings: [],
};

const run = (patientId: string | undefined, input: unknown, draftForWise = vi.fn().mockResolvedValue(resolved)) => {
	const context = { userId: 'u', patientId, services: { scribe: { draftForWise } } } as unknown as ToolContext;
	return proposeScribeNoteTool.execute!(input as never, {
		experimental_context: context,
		toolCallId: 't',
		messages: [],
	});
};

/**
 * The AI scribe's tool (DESIGN.md §7.5) with a mocked reader: it only reads, through the scribe facade, and returns
 * one draft whose parts the panel shows as separate cards. The whole flow with a scripted model is
 * `test/scribe.e2e-spec.ts`.
 */
describe('propose_scribe_note tool', () => {
	it("checks the draft through the scribe reader for the chat's patient and returns every part", async () => {
		const draftForWise = vi.fn().mockResolvedValue(resolved);
		const draft = scribeDemoDraft(' e1 ');
		expect(await run('p1', draft, draftForWise)).toEqual({ _version: '1', success: true, ...resolved });
		expect(draftForWise).toHaveBeenCalledWith('u', 'p1', { ...draft, encounterId: 'e1' });
	});

	it('lists the parts in the panel order, one card per diagnosis, and only the parts that hold something', () => {
		expect(proposeScribeNote.draftParts(scribeDemoDraft('e1'))).toEqual([
			'soap',
			'vitals',
			'diagnosis-0',
			'diagnosis-1',
			'prescription',
			'orders',
			'certificate',
			'follow_up',
			'summary',
		]);
		expect(
			proposeScribeNote.draftParts({
				encounterId: 'e1',
				soap: { plan: '  ' },
				vitals: { systolicMmHg: 0 },
				followUp: {},
				patientSummary: { language: 'en', text: '' },
			}),
		).toEqual([]);
	});

	it("refuses outside a patient's chart chat, without an encounter, and an empty draft", async () => {
		await expect(run(undefined, scribeDemoDraft('e1'))).rejects.toThrow(/open the patient's chart/);
		await expect(run('p1', { ...scribeDemoDraft('e1'), encounterId: ' ' })).rejects.toThrow(/Name the encounter/);
		await expect(run('p1', { encounterId: 'e1', soap: {} })).rejects.toThrow(/draft is empty/);
	});

	it('passes on a refusal to read the visit (another patient, another clinic)', async () => {
		const draftForWise = vi.fn().mockRejectedValue(new Error("That visit isn't this patient's."));
		await expect(run('p1', scribeDemoDraft('other'), draftForWise)).rejects.toThrow(/isn't this patient's/);
	});

	it('tells the model nothing is saved, and passes on the allergy, code and test warnings', () => {
		const output = proposeScribeNoteTool.toModelOutput!({
			toolCallId: 't',
			input: scribeDemoDraft('e1'),
			output: {
				...resolved,
				success: true,
				diagnoses: [{ icd10Code: 'X99.9', known: false, title: null }],
				allergyWarnings: [{ genericName: 'Amoxicillin', allergen: 'Penicillin' }],
			},
		});
		const text = JSON.stringify(output);
		expect(text).toMatch(/Nothing is saved yet/);
		expect(text).toMatch(/Amoxicillin \(allergy: Penicillin\)/);
		expect(text).toMatch(/Not in the ICD-10 list: X99.9/);
		expect(text).toMatch(/serum creatinine/);
	});
});
