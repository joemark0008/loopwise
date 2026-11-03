import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ConfigService } from '../config/config.service.js';
import { isNewerVersion, VersionCheckService } from './version-check.service.js';

describe('isNewerVersion', () => {
	it('never reports updates for dev builds', () => {
		expect(isNewerVersion('dev', '9.9.9')).toBe(false);
		expect(isNewerVersion('main', '9.9.9')).toBe(false);
	});

	it('compares semantic versions', () => {
		expect(isNewerVersion('1.2.3', '1.2.4')).toBe(true);
		expect(isNewerVersion('1.2.3', '1.10.0')).toBe(true);
		expect(isNewerVersion('2.0.0', '1.9.9')).toBe(false);
		expect(isNewerVersion('1.2.3', '1.2.3')).toBe(false);
	});

	it('treats a pre-release as older than the release', () => {
		expect(isNewerVersion('1.2.3-rc.1', '1.2.3')).toBe(true);
	});
});

describe('VersionCheckService', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('reads the latest stable release and caches the result', async () => {
		const fetchMock = vi.fn(async () =>
			Response.json([
				{ tag_name: 'v2.0.0-rc.1', prerelease: true },
				{ tag_name: 'cli-v9.0.0', prerelease: false },
				{ tag_name: 'v1.5.0', prerelease: false },
			]),
		);
		vi.stubGlobal('fetch', fetchMock);
		const service = new VersionCheckService({
			env: { APP_VERSION: '1.4.0', LOOPWISE_RELEASES_REPOSITORY: 'acme/loopwise' },
		} as ConfigService);

		await expect(service.checkForUpdate()).resolves.toEqual({
			currentVersion: '1.4.0',
			latestVersion: '1.5.0',
			updateAvailable: true,
		});
		await service.checkForUpdate();
		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.github.com/repos/acme/loopwise/releases',
			expect.anything(),
		);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('skips the check when no releases repository is configured', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		const service = new VersionCheckService({ env: { APP_VERSION: '1.4.0' } } as ConfigService);

		await expect(service.checkForUpdate()).resolves.toMatchObject({ latestVersion: null, updateAvailable: false });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('reports no update when GitHub is unreachable', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('', { status: 503 })),
		);
		const service = new VersionCheckService({
			env: { APP_VERSION: '1.4.0', LOOPWISE_RELEASES_REPOSITORY: 'acme/loopwise' },
		} as ConfigService);

		await expect(service.checkForUpdate()).resolves.toMatchObject({ latestVersion: null, updateAvailable: false });
	});
});
