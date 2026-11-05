import { describe, expect, it } from 'vitest';

import {
	draftStartToLocalInput,
	emptyEncounterForm,
	toCreateEncounterInput,
	toLocalInput,
	validateEncounterForm,
} from './encounter-form-values';

const NOW = new Date(2026, 9, 1, 14, 30);

describe('encounter form values', () => {
	it('starts a consultation now at the only clinic', () => {
		expect(emptyEncounterForm('hc', NOW)).toEqual({
			clinicId: 'hc',
			type: 'CONSULTATION',
			status: '',
			reason: '',
			notes: '',
			startedAt: '2026-10-01T14:30',
		});
	});

	it('uses the API rules, plus a required clinic', () => {
		expect(validateEncounterForm({ ...emptyEncounterForm('', NOW), reason: ' ' })).toEqual({
			reason: 'Add the reason for the visit.',
			clinicId: 'Choose the clinic.',
		});
		expect(validateEncounterForm({ ...emptyEncounterForm('hc', NOW), reason: 'BP check' })).toEqual({});
	});

	it('reads a drafted bare date as a day, not UTC midnight', () => {
		expect(draftStartToLocalInput('2026-10-01', NOW)).toBe('2026-10-01T14:30');
		expect(draftStartToLocalInput('2026-09-30', NOW)).toBe('2026-09-30T09:00');
		expect(draftStartToLocalInput(undefined, NOW)).toBe('2026-10-01T14:30');
		expect(draftStartToLocalInput('soon', NOW)).toBe('2026-10-01T14:30');
		const exact = new Date(2026, 8, 29, 8, 15);
		expect(draftStartToLocalInput(exact.toISOString(), NOW)).toBe(toLocalInput(exact));
	});

	it('sends blank notes as null and links the source chat', () => {
		const values = { ...emptyEncounterForm('hc', NOW), reason: 'BP check', notes: ' ' };
		expect(toCreateEncounterInput('p1', values, 'chat-1')).toEqual({
			patientId: 'p1',
			clinicId: 'hc',
			type: 'CONSULTATION',
			status: null,
			reason: 'BP check',
			notes: null,
			startedAt: NOW.toISOString(),
			sourceChatId: 'chat-1',
		});
	});
});
