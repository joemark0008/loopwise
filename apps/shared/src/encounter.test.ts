import { describe, expect, it } from 'vitest';

import { encounterDraftErrors, EncounterDraftSchema } from './encounter';

describe('EncounterDraftSchema', () => {
	it('trims the reason and drops empty notes and start time', () => {
		expect(EncounterDraftSchema.parse({ reason: '  BP check ', notes: ' ', startedAt: '' })).toEqual({
			reason: 'BP check',
			type: 'CONSULTATION',
		});
	});

	it('requires a reason and rejects a visit in the future or an invalid time', () => {
		expect(encounterDraftErrors({ reason: '' }).reason).toBe('Add the reason for the visit.');
		expect(encounterDraftErrors({ reason: 'x', startedAt: '2999-01-01T08:00:00Z' }).startedAt).toMatch(/future/);
		expect(encounterDraftErrors({ reason: 'x', startedAt: 'yesterday' }).startedAt).toMatch(/valid/);
		expect(encounterDraftErrors({ reason: 'x', startedAt: '2026-11-01T08:00:00+08:00' })).toEqual({});
	});
});
