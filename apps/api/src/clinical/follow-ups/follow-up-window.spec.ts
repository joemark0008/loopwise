import { describe, expect, it } from 'vitest';

import { followUpTiming, followUpWindow } from './follow-up-window.js';

describe('follow-up window', () => {
	it('covers 180 days back to a week ahead by default, clamped', () => {
		expect(followUpWindow('2026-11-06')).toEqual({ from: '2026-05-10', to: '2026-11-13' });
		expect(followUpWindow('2026-11-06', { withinDays: 0, overdueDays: 0 })).toEqual({
			from: '2026-11-06',
			to: '2026-11-06',
		});
		expect(followUpWindow('2026-11-06', { withinDays: 900, overdueDays: -4 })).toEqual({
			from: '2026-11-06',
			to: '2027-01-05',
		});
	});

	it('names a date overdue, due today or upcoming, with the days from today', () => {
		expect(followUpTiming('2026-11-01', '2026-11-06')).toEqual({ timing: 'OVERDUE', daysFromToday: -5 });
		expect(followUpTiming('2026-11-06', '2026-11-06')).toEqual({ timing: 'DUE', daysFromToday: 0 });
		expect(followUpTiming('2026-11-09', '2026-11-06')).toEqual({ timing: 'UPCOMING', daysFromToday: 3 });
	});
});
