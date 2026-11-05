import { describe, expect, it } from 'vitest';

import { InvalidStatusTransitionError } from '../../common/errors/domain-error.js';
import { transitionEncounterStatus } from './encounter-status.js';

describe('transitionEncounterStatus', () => {
	const now = new Date('2026-11-05T02:00:00Z');

	it('moves a visit forward, stamping the end of a completed or cancelled one', () => {
		expect(transitionEncounterStatus('OPEN', 'IN_PROGRESS', now)).toEqual({ status: 'IN_PROGRESS' });
		expect(transitionEncounterStatus('IN_PROGRESS', 'FOR_BILLING', now)).toEqual({ status: 'FOR_BILLING' });
		expect(transitionEncounterStatus('FOR_BILLING', 'COMPLETED', now)).toEqual({
			status: 'COMPLETED',
			endedAt: now,
		});
		expect(transitionEncounterStatus('IN_PROGRESS', 'COMPLETED', now)).toEqual({
			status: 'COMPLETED',
			endedAt: now,
		});
		expect(transitionEncounterStatus('OPEN', 'CANCELLED', now)).toEqual({ status: 'CANCELLED', endedAt: now });
	});

	it('lets the doctor reopen a visit sent to billing', () => {
		expect(transitionEncounterStatus('FOR_BILLING', 'IN_PROGRESS', now)).toEqual({ status: 'IN_PROGRESS' });
	});

	it('refuses skipping the doctor, going back, staying put and leaving a final status', () => {
		for (const [from, to] of [
			['OPEN', 'FOR_BILLING'],
			['OPEN', 'COMPLETED'],
			['IN_PROGRESS', 'OPEN'],
			['IN_PROGRESS', 'IN_PROGRESS'],
			['COMPLETED', 'IN_PROGRESS'],
			['COMPLETED', 'CANCELLED'],
			['CANCELLED', 'OPEN'],
		] as const) {
			expect(() => transitionEncounterStatus(from, to, now)).toThrow(InvalidStatusTransitionError);
		}
	});
});
