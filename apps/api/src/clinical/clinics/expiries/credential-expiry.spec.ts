import { describe, expect, it } from 'vitest';

import { type Credential, daysBetween, expiringCredentials } from './credential-expiry.js';

const credential = (overrides: Partial<Credential>): Credential => ({
	kind: 'PRC_LICENSE',
	subjectType: 'PRACTITIONER',
	subjectId: 'p1',
	subjectName: 'Dra. Ana Reyes',
	number: '0000001',
	expiresOn: null,
	...overrides,
});

describe('expiringCredentials', () => {
	it('counts calendar days', () => {
		expect(daysBetween('2026-11-06', '2027-01-05')).toBe(60);
		expect(daysBetween('2026-11-06', '2026-11-01')).toBe(-5);
	});

	it('lists what expires within 60 days, expired first, and skips the rest', () => {
		const list = expiringCredentials(
			[
				credential({ subjectId: 'a', expiresOn: '2027-01-05' }),
				credential({ subjectId: 'b', expiresOn: '2027-01-06' }),
				credential({ subjectId: 'c', expiresOn: '2026-11-01', kind: 'S2_LICENSE' }),
				credential({ subjectId: 'd', expiresOn: null }),
				credential({ subjectId: 'e', expiresOn: '2026-11-20', subjectType: 'CLINIC', kind: 'DOH_LICENSE' }),
			],
			'2026-11-06',
		);
		expect(list.map(({ subjectId, daysLeft }) => [subjectId, daysLeft])).toEqual([
			['c', -5],
			['e', 14],
			['a', 60],
		]);
	});

	it('takes another window', () => {
		expect(expiringCredentials([credential({ expiresOn: '2026-12-31' })], '2026-11-06', 30)).toEqual([]);
	});
});
