import { describe, expect, it } from 'vitest';

import { auditChanges, auditSnapshot } from './audit-changes.js';

describe('auditChanges', () => {
	const before = {
		id: 'e1',
		status: 'OPEN',
		chiefComplaint: 'Cough',
		followUpDate: new Date('2026-11-12T00:00:00Z'),
		version: 1,
		updatedAt: new Date('2026-11-05T00:00:00Z'),
	};

	it('keeps only the fields that changed, as JSON, without bookkeeping columns', () => {
		const after = { ...before, status: 'IN_PROGRESS', version: 2, updatedAt: new Date() };
		expect(auditChanges(before, after)).toEqual({ before: { status: 'OPEN' }, after: { status: 'IN_PROGRESS' } });
	});

	it('serialises dates and limits the comparison to the given fields', () => {
		const after = { ...before, chiefComplaint: 'Fever', followUpDate: new Date('2026-11-19T00:00:00Z') };
		expect(auditChanges(before, after, ['followUpDate'])).toEqual({
			before: { followUpDate: '2026-11-12T00:00:00.000Z' },
			after: { followUpDate: '2026-11-19T00:00:00.000Z' },
		});
	});

	it('is null when nothing changed', () => {
		expect(auditChanges(before, { ...before, version: 5 })).toBeNull();
	});

	it('handles a created row', () => {
		expect(auditChanges(null, { id: 'x', status: 'DRAFT' })).toEqual({
			before: null,
			after: { id: 'x', status: 'DRAFT' },
		});
	});
});

describe('auditSnapshot', () => {
	it('copies the row as JSON without bookkeeping columns', () => {
		expect(auditSnapshot({ id: 'x', at: new Date('2026-01-01T00:00:00Z'), version: 1, note: undefined })).toEqual({
			id: 'x',
			at: '2026-01-01T00:00:00.000Z',
			note: null,
		});
	});
});
