import { describe, expect, it } from 'vitest';

import { InvalidStatusTransitionError } from '../../../common/errors/domain-error.js';
import { transitionAppointment } from './appointment-status.js';

describe('transitionAppointment', () => {
	it('moves a booking through check-in to the end of the visit', () => {
		expect(transitionAppointment('SCHEDULED', 'CONFIRMED')).toEqual({ status: 'CONFIRMED' });
		expect(transitionAppointment('CONFIRMED', 'ARRIVED')).toEqual({ status: 'ARRIVED' });
		expect(transitionAppointment('ARRIVED', 'IN_PROGRESS')).toEqual({ status: 'IN_PROGRESS' });
		expect(transitionAppointment('IN_PROGRESS', 'COMPLETED')).toEqual({ status: 'COMPLETED' });
	});

	it('cancels, reschedules or marks a no-show only before check-in', () => {
		expect(transitionAppointment('SCHEDULED', 'RESCHEDULED')).toEqual({ status: 'RESCHEDULED' });
		expect(transitionAppointment('CONFIRMED', 'NO_SHOW')).toEqual({ status: 'NO_SHOW' });
		expect(transitionAppointment('ARRIVED', 'CANCELLED')).toEqual({ status: 'CANCELLED' });
		expect(() => transitionAppointment('ARRIVED', 'RESCHEDULED')).toThrow(InvalidStatusTransitionError);
		expect(() => transitionAppointment('IN_PROGRESS', 'CANCELLED')).toThrow(InvalidStatusTransitionError);
	});

	it('keeps the final statuses final, and refuses staying put', () => {
		for (const status of ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'] as const) {
			expect(() => transitionAppointment(status, 'SCHEDULED')).toThrow(InvalidStatusTransitionError);
		}
		expect(() => transitionAppointment('SCHEDULED', 'SCHEDULED')).toThrow(InvalidStatusTransitionError);
	});
});
