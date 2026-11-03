import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn(), mutate: vi.fn() }));

vi.mock('@/lib/apollo-client', () => ({ apolloClient: { query: mocks.query, mutate: mocks.mutate } }));

function graphQLError(code: string, message: string) {
	return Object.assign(new Error(message), { data: { code } });
}

describe('setup-api', () => {
	beforeEach(() => {
		vi.resetModules();
		mocks.query.mockReset();
		mocks.mutate.mockReset();
	});

	it('returns false and asks again until there are users', async () => {
		mocks.query.mockResolvedValue({ data: { hasUsers: false } });
		const { isSetupComplete } = await import('./setup-api');

		expect(await isSetupComplete()).toBe(false);
		expect(await isSetupComplete()).toBe(false);
		expect(mocks.query).toHaveBeenCalledTimes(2);
	});

	it('caches true', async () => {
		mocks.query.mockResolvedValue({ data: { hasUsers: true } });
		const { isSetupComplete } = await import('./setup-api');

		expect(await isSetupComplete()).toBe(true);
		expect(await isSetupComplete()).toBe(true);
		expect(mocks.query).toHaveBeenCalledTimes(1);
	});

	it('treats a failed request as set up, without caching it', async () => {
		mocks.query.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: { hasUsers: false } });
		const { isSetupComplete } = await import('./setup-api');

		expect(await isSetupComplete()).toBe(true);
		expect(await isSetupComplete()).toBe(false);
		expect(mocks.query).toHaveBeenCalledTimes(2);
	});

	it('markSetupComplete caches true without a request', async () => {
		const { isSetupComplete, markSetupComplete } = await import('./setup-api');

		markSetupComplete();

		expect(await isSetupComplete()).toBe(true);
		expect(mocks.query).not.toHaveBeenCalled();
	});

	it('maps FORBIDDEN to invalid-token and CONFLICT to already-complete', async () => {
		const input = { token: 't', name: 'Ada', email: 'ada@example.com', password: 'password123' };
		const { completeSetup } = await import('./setup-api');

		mocks.mutate.mockResolvedValueOnce({ data: { completeSetup: true } });
		expect(await completeSetup(input)).toEqual({ status: 'ok' });

		mocks.mutate.mockRejectedValueOnce(graphQLError('FORBIDDEN', 'Invalid setup token.'));
		expect(await completeSetup(input)).toEqual({ status: 'invalid-token' });

		mocks.mutate.mockRejectedValueOnce(graphQLError('CONFLICT', 'Setup is already complete.'));
		expect(await completeSetup(input)).toEqual({ status: 'already-complete' });

		mocks.mutate.mockRejectedValueOnce(graphQLError('BAD_USER_INPUT', 'password too short'));
		expect(await completeSetup(input)).toEqual({ status: 'error', message: 'password too short' });
	});
});
