import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { QuarryRequest } from '../common/request.js';
import { FacilityKeyGuard } from './facility-key.guard.js';
import type { FacilityKeyService } from './facility-key.service.js';
import { describeFacilityKey, generateFacilityKey, readBearerFacilityKey } from './facility-key-token.js';

const LAB = { id: 'org-lab', name: 'Lab' };

const contextFor = (req: Partial<QuarryRequest>) =>
	({
		getType: () => 'http',
		switchToHttp: () => ({ getRequest: () => req }),
	}) as unknown as ExecutionContext;

describe('facility key tokens', () => {
	it('issues lw_ keys and stores only a sha256 hash and a short prefix', () => {
		const issued = generateFacilityKey();
		expect(issued.key).toMatch(/^lw_[A-Za-z0-9_-]{43}$/);
		expect(issued.keyHash).toMatch(/^[0-9a-f]{64}$/);
		expect(issued.keyHash).not.toContain(issued.key);
		expect(issued.keyPrefix).toBe(issued.key.slice(0, 10));
		expect(generateFacilityKey().key).not.toBe(issued.key);
		expect(describeFacilityKey(issued.key).keyHash).toBe(issued.keyHash);
	});

	it('reads only Bearer lw_ keys', () => {
		expect(readBearerFacilityKey('Bearer lw_abc')).toBe('lw_abc');
		expect(readBearerFacilityKey('bearer lw_abc ')).toBe('lw_abc');
		expect(readBearerFacilityKey('Bearer session-token')).toBeNull();
		expect(readBearerFacilityKey('Basic lw_abc')).toBeNull();
		expect(readBearerFacilityKey(undefined)).toBeNull();
	});
});

describe('FacilityKeyGuard', () => {
	const service = {
		authenticate: vi.fn(async (key: string) => (key === 'lw_good' ? LAB : null)),
	} as unknown as FacilityKeyService;
	const guard = new FacilityKeyGuard(service);

	it('sets the facility for a valid key', async () => {
		const req: Partial<QuarryRequest> = { headers: { authorization: 'Bearer lw_good' } };
		await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);
		expect(req.facility).toEqual(LAB);
	});

	it.each([['Bearer lw_revoked'], ['Bearer nope'], [undefined]])('rejects %s with 401', async (authorization) => {
		const req: Partial<QuarryRequest> = { headers: { authorization } };
		await expect(guard.canActivate(contextFor(req))).rejects.toMatchObject({ code: 401 });
		expect(req.facility).toBeUndefined();
	});
});
