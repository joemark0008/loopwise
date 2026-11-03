import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ClinicalEventsService } from './clinical-events.service.js';

describe('ClinicalEventsService', () => {
	const payload = { resultId: 'r1', patientId: 'p1', orderId: null };

	it('delivers to every subscriber until it unsubscribes', async () => {
		const events = new ClinicalEventsService();
		const first = vi.fn();
		const second = vi.fn(async () => {});
		const off = events.on('result.received', first);
		events.on('result.received', second);
		await events.emit('result.received', payload);
		off();
		await events.emit('result.received', payload);
		expect(first).toHaveBeenCalledTimes(1);
		expect(second).toHaveBeenCalledTimes(2);
		expect(second).toHaveBeenCalledWith(payload);
	});

	it('keeps going when a handler throws', async () => {
		const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
		const events = new ClinicalEventsService();
		const after = vi.fn();
		events.on('result.received', () => {
			throw new Error('boom');
		});
		events.on('result.received', after);
		await expect(events.emit('result.received', payload)).resolves.toBeUndefined();
		expect(after).toHaveBeenCalled();
		expect(logged).toHaveBeenCalledWith('A result.received handler failed', expect.stringContaining('boom'));
		logged.mockRestore();
	});
});
