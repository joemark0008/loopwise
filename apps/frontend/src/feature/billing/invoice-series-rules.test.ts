import { describe, expect, it } from 'vitest';

import { isLastUsableSeries } from './invoice-series-rules';

const series = (id: string, state: 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED' | 'INACTIVE', docType = 'SALES_INVOICE') => ({
	id,
	docType,
	isActive: state !== 'INACTIVE',
	state,
});

describe('isLastUsableSeries', () => {
	it('is true for the only series still in use', () => {
		const inUse = series('a', 'ACTIVE');
		expect(isLastUsableSeries([inUse, series('b', 'EXHAUSTED'), series('c', 'INACTIVE')], inUse)).toBe(true);
	});

	it('is false while another series of the same document type is in use', () => {
		const first = series('a', 'ACTIVE');
		expect(isLastUsableSeries([first, series('b', 'ACTIVE')], first)).toBe(false);
	});

	it('counts only series of the same document type', () => {
		const sales = series('a', 'ACTIVE');
		expect(isLastUsableSeries([sales, series('b', 'ACTIVE', 'SERVICE_INVOICE')], sales)).toBe(true);
	});

	it('is false for a series that is not in use (used up, expired or already off)', () => {
		for (const state of ['EXHAUSTED', 'EXPIRED', 'INACTIVE'] as const) {
			const target = series('a', state);
			expect(isLastUsableSeries([target], target)).toBe(false);
		}
	});
});
