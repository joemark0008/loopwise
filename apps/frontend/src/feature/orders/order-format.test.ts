import { describe, expect, it } from 'vitest';

import { ageSex, byPriorityThenAge, parameterRange, personName, waitingFor } from './order-format';

const item = (id: string, priority: 'ROUTINE' | 'URGENT' | 'STAT', createdAt: string) => ({
	id,
	order: { priority, createdAt },
});

describe('order format', () => {
	it('sorts STAT first, then urgent, then routine, oldest first within each', () => {
		const items = [
			item('routine-old', 'ROUTINE', '2026-11-06T01:00:00Z'),
			item('urgent', 'URGENT', '2026-11-06T03:00:00Z'),
			item('stat', 'STAT', '2026-11-06T04:00:00Z'),
			item('routine-new', 'ROUTINE', '2026-11-06T02:00:00Z'),
		];
		expect(byPriorityThenAge(items).map((row) => row.id)).toEqual(['stat', 'urgent', 'routine-old', 'routine-new']);
	});

	it('says how long a test has waited', () => {
		const now = new Date('2026-11-06T12:00:00Z');
		expect(waitingFor('2026-11-06T11:48:00Z', now)).toBe('12 min');
		expect(waitingFor('2026-11-06T09:00:00Z', now)).toBe('3 h');
		expect(waitingFor('2026-11-04T09:00:00Z', now)).toBe('2 d');
		expect(waitingFor('2026-11-06T12:05:00Z', now)).toBe('0 min');
	});

	it('gives the patient line: name, age in whole years and sex', () => {
		const today = new Date('2026-11-06T12:00:00');
		expect(ageSex('1981-04-12', 'FEMALE', today)).toBe('45 F');
		expect(ageSex('1963-11-30', 'MALE', today)).toBe('62 M');
		expect(personName({ firstName: 'Maria', lastName: 'Santos' })).toBe('Maria Santos');
	});

	it("prints a parameter's range for the patient's sex", () => {
		const hgb = { refLowMale: 13.5, refHighMale: 17.5, refLowFemale: 12, refHighFemale: 15.5 };
		expect(parameterRange(hgb, 'MALE')).toBe('13.5–17.5');
		expect(parameterRange(hgb, 'FEMALE')).toBe('12–15.5');
		expect(parameterRange({ refHighMale: 200, refHighFemale: 200 }, 'FEMALE')).toBe('< 200');
		expect(parameterRange({ refLowMale: 40 }, 'MALE')).toBe('≥ 40');
		expect(parameterRange({ refRangeText: 'Negative' }, 'MALE')).toBe('Negative');
	});
});
