import { Logger } from '@nestjs/common';
import { hashPassword } from 'better-auth/crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConfigService } from '../config/config.service.js';
import type { UserRepository } from '../users/user.repository.js';
import type { SetupRepository } from './setup.repository.js';
import { SetupService } from './setup.service.js';
import { deriveSetupToken } from './setup-token.js';

vi.mock('better-auth/crypto', () => ({ hashPassword: vi.fn().mockResolvedValue('hashed') }));

const SECRET = 'x'.repeat(32);
const config = { env: { BETTER_AUTH_SECRET: SECRET }, baseUrl: 'http://localhost:5005' } as unknown as ConfigService;

const countUsers = vi.fn();
const createFirstAdmin = vi.fn();
const service = new SetupService(
	config,
	{ countUsers } as unknown as UserRepository,
	{ createFirstAdmin } as unknown as SetupRepository,
);

let log: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
	log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
	createFirstAdmin.mockReset().mockResolvedValue({});
	vi.mocked(hashPassword).mockClear();
});
afterEach(() => log.mockRestore());

describe('onApplicationBootstrap', () => {
	it('logs the token and URL when no users exist', async () => {
		countUsers.mockResolvedValue(0);
		await service.onApplicationBootstrap();
		expect(log).toHaveBeenCalledTimes(1);
		const message = String(log.mock.calls[0][0]);
		expect(message).toContain(deriveSetupToken(SECRET));
		expect(message).toContain('http://localhost:5005/setup');
	});

	it('logs nothing once a user exists', async () => {
		countUsers.mockResolvedValue(1);
		await service.onApplicationBootstrap();
		expect(log).not.toHaveBeenCalled();
	});
});

describe('completeSetup', () => {
	it('does not hash the password for a wrong token', async () => {
		await expect(
			service.completeSetup({ token: 'nope', name: 'A', email: 'a@b.co', password: 'password1' }),
		).rejects.toMatchObject({ codeMessage: 'FORBIDDEN', message: 'Invalid setup token.' });
		expect(hashPassword).not.toHaveBeenCalled();
		expect(createFirstAdmin).not.toHaveBeenCalled();
	});
});
