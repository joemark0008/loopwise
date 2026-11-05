import { describe, expect, it } from 'vitest';

import { scribeOutcomeKey, scribePartKind, scribePartTool, scribeRequestMessage } from './scribe';

describe('AI scribe parts', () => {
	it('maps each part to the card it confirms as', () => {
		expect(scribePartTool('soap')).toBe('propose_encounter_note');
		expect(scribePartTool('follow_up')).toBe('propose_encounter_note');
		expect(scribePartTool('summary')).toBe('propose_encounter_note');
		expect(scribePartTool('vitals')).toBe('propose_vitals');
		expect(scribePartTool('diagnosis-3')).toBe('propose_diagnosis');
		expect(scribePartTool('prescription')).toBe('propose_prescription');
		expect(scribePartTool('orders')).toBe('propose_order');
		expect(scribePartTool('certificate')).toBe('propose_medical_certificate');
	});

	it('refuses keys that are not parts', () => {
		for (const key of ['', 'diagnosis', 'diagnosis-8', 'diagnosis-10', 'soap#x', 'billing', 'SOAP']) {
			expect(scribePartKind(key), key).toBeUndefined();
		}
	});

	it('settles each part under its own key', () => {
		expect(scribeOutcomeKey('call_1', 'soap')).toBe('call_1#soap');
		expect(scribeOutcomeKey('call_1')).toBe('call_1');
	});

	it('asks Wise for one draft of the visit, with the language and the transcript', () => {
		const message = scribeRequestMessage({ encounterId: 'e1', language: 'fil', transcript: '  BP 140/90.  ' });
		expect(message).toContain('propose_scribe_note');
		expect(message).toContain('encounter e1');
		expect(message).toContain('Filipino');
		expect(message).toContain('<transcript>\nBP 140/90.\n</transcript>');
	});
});
