import { describe, expect, it, vi } from 'vitest';

import type { ClinicalDbService } from '../rls/clinical-db.service.js';
import type { PathwayRepository } from './pathway.repository.js';
import { PATHWAY_DEFINITIONS } from './pathway-definitions.js';
import { PathwaysService } from './pathways.service.js';

const setup = (rows: unknown[][]) => {
	const listActive = vi.fn();
	for (const batch of rows) {
		listActive.mockResolvedValueOnce(batch);
	}
	const db = { asSystem: (fn: (tx: unknown) => unknown) => fn({}) } as unknown as ClinicalDbService;
	return { service: new PathwaysService(db, { listActive } as unknown as PathwayRepository), listActive };
};

describe('PathwaysService', () => {
	it('validates and caches the active pathways for a minute', async () => {
		const { service, listActive } = setup([[...PATHWAY_DEFINITIONS], [...PATHWAY_DEFINITIONS]]);
		const first = await service.active(0);
		expect(first.map((p) => p.key)).toEqual(['diabetes', 'breast', 'potassium']);
		await service.active(59_999);
		expect(listActive).toHaveBeenCalledTimes(1);
		await service.active(60_000);
		expect(listActive).toHaveBeenCalledTimes(2);
	});

	it('fails loudly on an invalid row, and retries on the next call', async () => {
		const broken = { ...PATHWAY_DEFINITIONS[0], rules: { ...PATHWAY_DEFINITIONS[0].rules, schemaVersion: 1 } };
		const { service, listActive } = setup([[broken], [...PATHWAY_DEFINITIONS]]);
		await expect(service.active(0)).rejects.toThrow(/^Pathway diabetes is invalid:/);
		await expect(service.active(1)).resolves.toHaveLength(3);
		expect(listActive).toHaveBeenCalledTimes(2);
	});

	it('reloads after invalidate', async () => {
		const { service, listActive } = setup([[...PATHWAY_DEFINITIONS], [...PATHWAY_DEFINITIONS]]);
		await service.active(0);
		service.invalidate();
		await service.active(1);
		expect(listActive).toHaveBeenCalledTimes(2);
	});
});
