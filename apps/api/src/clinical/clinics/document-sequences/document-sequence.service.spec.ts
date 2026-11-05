import { describe, expect, it, vi } from 'vitest';

import type { ClinicalTx } from '../../rls/clinical-db.service.js';
import type { DocumentSequenceRepository } from './document-sequence.repository.js';
import { DocumentSequenceService, manilaYear } from './document-sequence.service.js';

describe('DocumentSequenceService', () => {
	it('formats the clinic code, key, year and padded value', async () => {
		const takeNext = vi.fn().mockResolvedValue({ value: 123, prefix: 'TAG-RX-2026-', padLength: 6 });
		const service = new DocumentSequenceService({ takeNext } as unknown as DocumentSequenceRepository);

		const number = await service.next(
			{} as ClinicalTx,
			{ id: 'c1', code: 'TAG' },
			'RX',
			new Date('2026-11-05T00:00:00Z'),
		);

		expect(number).toBe('TAG-RX-2026-000123');
		expect(takeNext).toHaveBeenCalledWith(expect.anything(), {
			clinicId: 'c1',
			key: 'RX',
			year: 2026,
			prefix: 'TAG-RX-2026-',
			padLength: 6,
		});
	});

	it('takes the year in Asia/Manila', () => {
		expect(manilaYear(new Date('2026-12-31T16:30:00Z'))).toBe(2027);
		expect(manilaYear(new Date('2026-12-31T15:59:00Z'))).toBe(2026);
	});
});
