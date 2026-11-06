import { describe, expect, it } from 'vitest';

import { InvalidStatusTransitionError } from '../../../common/errors/domain-error.js';
import {
	byCallOrder,
	callTicket,
	cancelTicket,
	finishTicket,
	followVisit,
	laneOf,
	requeueTicket,
	serveTicket,
	skipTicket,
	ticketCode,
	transferTicket,
} from './queue-status.js';

describe('queue ticket status', () => {
	const now = new Date('2026-11-06T01:00:00Z');

	it('walks a ticket from waiting to done, stamping each step', () => {
		expect(callTicket('WAITING', now)).toEqual({ status: 'CALLED', calledAt: now });
		expect(serveTicket('CALLED', now)).toEqual({ status: 'SERVING', servedAt: now });
		expect(finishTicket('SERVING', now)).toEqual({ status: 'DONE', doneAt: now });
	});

	it('sends a patient being served to the next station, waiting again with the same number', () => {
		expect(transferTicket('SERVING', 'DOCTOR')).toEqual({
			status: 'WAITING',
			station: 'DOCTOR',
			calledAt: null,
			servedAt: null,
		});
		expect(() => transferTicket('CALLED', 'DOCTOR')).toThrow(InvalidStatusTransitionError);
		expect(() => transferTicket('WAITING', 'DOCTOR')).toThrow(InvalidStatusTransitionError);
	});

	it('skips a called patient and requeues them when they come back', () => {
		expect(skipTicket('CALLED')).toEqual({ status: 'SKIPPED' });
		expect(requeueTicket('SKIPPED')).toEqual({ status: 'WAITING', calledAt: null });
		expect(() => skipTicket('WAITING')).toThrow(InvalidStatusTransitionError);
		expect(() => requeueTicket('SERVING')).toThrow(InvalidStatusTransitionError);
	});

	it('cancels any open ticket and nothing after done', () => {
		for (const status of ['WAITING', 'CALLED', 'SERVING', 'SKIPPED'] as const) {
			expect(cancelTicket(status, now)).toEqual({ status: 'CANCELLED', doneAt: now });
		}
		expect(() => cancelTicket('DONE')).toThrow(InvalidStatusTransitionError);
		expect(() => callTicket('DONE')).toThrow(InvalidStatusTransitionError);
		expect(() => serveTicket('WAITING')).toThrow(InvalidStatusTransitionError);
	});

	it('puts the priority lane under P and the rest under A', () => {
		expect(laneOf('SENIOR_CITIZEN')).toEqual({ prefix: 'P', isPriority: true });
		expect(laneOf('PWD')).toEqual({ prefix: 'P', isPriority: true });
		expect(laneOf(null)).toEqual({ prefix: 'A', isPriority: false });
		expect(ticketCode({ prefix: 'P', number: 2 })).toBe('P-002');
	});

	it('calls the priority lane first, then by arrival', () => {
		const at = (minute: number) => new Date(now.getTime() + minute * 60_000);
		const order = byCallOrder([
			{ id: 'A-1', isPriority: false, number: 1, issuedAt: at(0) },
			{ id: 'A-2', isPriority: false, number: 2, issuedAt: at(5) },
			{ id: 'P-1', isPriority: true, number: 1, issuedAt: at(10) },
		]);
		expect(order.map((ticket) => ticket.id)).toEqual(['P-1', 'A-1', 'A-2']);
	});

	describe('followVisit (the visit moved from the encounter page)', () => {
		it('brings a ticket waiting at triage to the doctor, serving', () => {
			expect(followVisit({ status: 'WAITING', station: 'TRIAGE' }, 'IN_PROGRESS', now)).toEqual({
				status: 'SERVING',
				station: 'DOCTOR',
				calledAt: now,
				servedAt: now,
			});
			expect(followVisit({ status: 'SKIPPED', station: 'DOCTOR' }, 'IN_PROGRESS', now)).toEqual({
				status: 'SERVING',
				calledAt: now,
				servedAt: now,
			});
			expect(followVisit({ status: 'SERVING', station: 'DOCTOR' }, 'IN_PROGRESS', now)).toBeNull();
		});

		it('sends the ticket to the cashier for billing, and back to the doctor on reopening', () => {
			expect(followVisit({ status: 'SERVING', station: 'DOCTOR' }, 'FOR_BILLING', now)).toEqual({
				status: 'WAITING',
				station: 'CASHIER',
				calledAt: null,
				servedAt: null,
			});
			expect(followVisit({ status: 'WAITING', station: 'CASHIER' }, 'FOR_BILLING', now)).toBeNull();
			expect(followVisit({ status: 'WAITING', station: 'CASHIER' }, 'IN_PROGRESS', now)).toEqual({
				status: 'SERVING',
				station: 'DOCTOR',
				calledAt: now,
				servedAt: now,
			});
		});

		it('finishes or cancels the ticket with the visit, and leaves closed tickets and OPEN alone', () => {
			expect(followVisit({ status: 'WAITING', station: 'DOCTOR' }, 'COMPLETED', now)).toEqual({
				status: 'DONE',
				calledAt: now,
				servedAt: now,
				doneAt: now,
			});
			expect(followVisit({ status: 'CALLED', station: 'TRIAGE' }, 'CANCELLED', now)).toEqual({
				status: 'CANCELLED',
				doneAt: now,
			});
			expect(followVisit({ status: 'DONE', station: 'CASHIER' }, 'COMPLETED', now)).toBeNull();
			expect(followVisit({ status: 'WAITING', station: 'TRIAGE' }, 'OPEN', now)).toBeNull();
		});
	});
});
