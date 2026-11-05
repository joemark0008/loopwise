import { describe, expect, it } from 'vitest';
import { linesOf } from './queue-page';
import { addDays, dayLabel, manilaDate, manilaTime, waited } from './scheduling-format';
import type { QueueTicketFieldsFragment } from '@/graphql/generated/graphql';

describe('scheduling format', () => {
	it('reads days and clock times in Manila', () => {
		expect(manilaDate(new Date('2026-11-08T16:30:00Z'))).toBe('2026-11-09');
		expect(manilaTime('2026-11-09T01:15:00.000Z')).toBe('09:15');
		expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
		expect(dayLabel('2026-11-09')).toBe('Mon 9 Nov');
	});

	it('says how long a patient has waited', () => {
		const now = new Date('2026-11-09T02:00:00Z');
		expect(waited('2026-11-09T01:56:00Z', now)).toBe('4 min');
		expect(waited('2026-11-09T00:55:00Z', now)).toBe('1 h 05 min');
	});
});

describe('linesOf', () => {
	const ticket = (code: string, station: string, status: string, doctor?: string) =>
		({
			id: code,
			code,
			station,
			status,
			stationLabel: doctor ?? station,
			practitioner: doctor ? { id: doctor } : null,
		}) as unknown as QueueTicketFieldsFragment;

	it('groups the open tickets by station, one line per doctor, and leaves the done ones out', () => {
		const lines = linesOf([
			ticket('P-001', 'TRIAGE', 'WAITING'),
			ticket('A-001', 'TRIAGE', 'CALLED'),
			ticket('A-002', 'DOCTOR', 'WAITING', 'Dra. Reyes'),
			ticket('A-003', 'DOCTOR', 'SERVING', 'Dr. Cruz'),
			ticket('A-004', 'CASHIER', 'DONE'),
		]);
		expect(lines.map((line) => [line.title, line.tickets.map((t) => t.code)])).toEqual([
			['Triage', ['P-001', 'A-001']],
			['Dra. Reyes', ['A-002']],
			['Dr. Cruz', ['A-003']],
			['Cashier', []],
		]);
	});
});
