import { describe, expect, it } from 'vitest';
import { scribeDemoDraft } from '@loopwise/shared/scribe-demo';
import {
	followUpDate,
	isInLatestMessage,
	latestScribeDraft,
	progressLine,
	scribeProgress,
	soapDraftValues,
	summaryLanguageFor,
} from './scribe-draft';
import type { UIMessage } from '@loopwise/api/agent/types/chat';

const note = {
	reason: 'BP check',
	history: 'Old history',
	reviewOfSystems: '',
	subjective: '',
	physicalExam: '',
	objective: '',
	assessment: '',
	plan: 'Old plan',
	patientInstructions: 'Old instructions',
	followUpOn: '',
	disposition: '' as const,
};

const scribePart = (toolCallId: string, encounterId: string, state = 'output-available') => ({
	type: 'tool-propose_scribe_note',
	toolCallId,
	state,
	input: { encounterId },
	output: state === 'output-available' ? { encounter: { id: encounterId } } : undefined,
});

describe('scribe draft helpers', () => {
	it('finds the latest scribe draft of the visit in the chat, streaming or done', () => {
		const messages = [
			{ id: 'm1', role: 'assistant', parts: [scribePart('a', 'e1')] },
			{ id: 'm2', role: 'assistant', parts: [scribePart('b', 'e2'), { type: 'text', text: 'Done' }] },
			{ id: 'm3', role: 'assistant', parts: [scribePart('c', 'e1', 'input-available')] },
		] as unknown as UIMessage[];
		expect(latestScribeDraft(messages, 'e1')?.toolCallId).toBe('c');
		expect(latestScribeDraft(messages, 'e2')?.toolCallId).toBe('b');
		expect(latestScribeDraft(messages, 'e3')).toBeNull();
	});

	it('tells whether a call is in the latest message, the one a running turn is still writing', () => {
		const messages = [
			{ id: 'm1', role: 'assistant', parts: [scribePart('a', 'e1')] },
			{ id: 'm2', role: 'assistant', parts: [{ type: 'step-start' }, scribePart('b', 'e1')] },
		] as unknown as UIMessage[];
		expect(isInLatestMessage(messages, 'b')).toBe(true);
		expect(isInLatestMessage(messages, 'a')).toBe(false);
		expect(isInLatestMessage([], 'a')).toBe(false);
	});

	it('writes the drafted SOAP sections over the note and keeps the ones not drafted', () => {
		const merged = soapDraftValues(note, { chiefComplaint: 'Follow-up', subjective: 'Misses doses', plan: '  ' });
		expect(merged).toMatchObject({
			reason: 'Follow-up',
			history: 'Old history',
			subjective: 'Misses doses',
			plan: 'Old plan',
			patientInstructions: 'Old instructions',
		});
	});

	it('takes the follow-up date said, else counts the interval from the visit day', () => {
		expect(followUpDate({ date: '2026-11-20', inDays: 7 }, '2026-11-06T01:00:00.000Z')).toBe('2026-11-20');
		expect(followUpDate({ inDays: 14 }, '2026-11-06T23:30:00.000Z')).toBe('2026-11-20');
		expect(followUpDate({ date: 'next week' }, '2026-11-06T01:00:00.000Z')).toBe('');
		expect(followUpDate(undefined, '2026-11-06T01:00:00.000Z')).toBe('');
	});

	it("picks the summary language from the patient's preferred language", () => {
		expect(summaryLanguageFor('ceb')).toBe('ceb');
		expect(summaryLanguageFor('Cebuano (Bisaya)')).toBe('ceb');
		expect(summaryLanguageFor('Tagalog')).toBe('fil');
		expect(summaryLanguageFor(null)).toBe('en');
	});

	it('counts the parts saved, edited, dismissed and still to review', () => {
		const parts = ['soap', 'vitals', 'diagnosis-0', 'summary'];
		const progress = scribeProgress('call', parts, [
			{ toolCallId: 'call#soap', status: 'confirmed', edited: true },
			{ toolCallId: 'call#vitals', status: 'confirmed', edited: false },
			{ toolCallId: 'call#summary', status: 'cancelled', edited: false },
			{ toolCallId: 'other#diagnosis-0', status: 'confirmed', edited: false },
		]);
		expect(progress).toEqual({ total: 4, confirmed: 2, edited: 1, dismissed: 1, open: 1 });
		expect(progressLine(progress)).toBe('2 of 4 saved (1 edited) · 1 dismissed · 1 to review');
	});

	it('keeps the demo draft synthetic: Maria Santos, hypertension and diabetes', () => {
		const draft = scribeDemoDraft('e1');
		expect(draft.diagnoses?.map((diagnosis) => diagnosis.icd10Code)).toEqual(['I10', 'E11.9']);
		expect(draft.prescription?.items.map((item) => item.genericName)).toEqual([
			'Metformin',
			'Amlodipine',
			'Losartan',
		]);
	});
});
