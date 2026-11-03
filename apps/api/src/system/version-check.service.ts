import { Injectable } from '@nestjs/common';

import { ConfigService } from '../config/config.service.js';

/** Port of upstream `services/version-check.service.ts`, against the GitHub repository in LOOPWISE_RELEASES_REPOSITORY. */
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const APP_RELEASE_TAG_REGEX = /^v\d+\.\d+\.\d+$/;

export interface VersionCheckResult {
	currentVersion: string;
	latestVersion: string | null;
	updateAvailable: boolean;
}

@Injectable()
export class VersionCheckService {
	private cachedResult: VersionCheckResult | null = null;
	private cachedAt = 0;

	constructor(private readonly config: ConfigService) {}

	async checkForUpdate(): Promise<VersionCheckResult> {
		const now = Date.now();
		if (this.cachedResult && now - this.cachedAt < CACHE_TTL_MS) {
			return this.cachedResult;
		}

		const currentVersion = this.config.env.APP_VERSION;
		const repository = this.config.env.LOOPWISE_RELEASES_REPOSITORY;
		const latestVersion = repository ? await fetchLatestVersion(repository) : null;
		const updateAvailable = latestVersion !== null && isNewerVersion(currentVersion, latestVersion);

		this.cachedResult = { currentVersion, latestVersion, updateAvailable };
		this.cachedAt = now;
		return this.cachedResult;
	}
}

async function fetchLatestVersion(repository: string): Promise<string | null> {
	try {
		const response = await fetch(`https://api.github.com/repos/${repository}/releases`, {
			headers: { Accept: 'application/vnd.github.v3+json' },
			signal: AbortSignal.timeout(5000),
		});
		if (!response.ok) {
			return null;
		}
		const releases = (await response.json()) as { tag_name?: string; prerelease?: boolean }[];
		const appRelease = releases.find((r) => !r.prerelease && r.tag_name && APP_RELEASE_TAG_REGEX.test(r.tag_name));
		return appRelease?.tag_name?.replace(/^v/, '') ?? null;
	} catch {
		return null;
	}
}

export function isNewerVersion(current: string, latest: string): boolean {
	if (current === 'dev' || current === 'main') {
		return false;
	}

	if (current === 'unknown') {
		return true;
	}

	const currentParts = parseVersion(current);
	const latestParts = parseVersion(latest);
	if (!currentParts || !latestParts) {
		return current !== latest;
	}

	for (let i = 0; i < 3; i++) {
		if (latestParts[i] > currentParts[i]) {
			return true;
		}
		if (latestParts[i] < currentParts[i]) {
			return false;
		}
	}
	if (currentParts[3] && !latestParts[3]) {
		return true;
	}
	return false;
}

function parseVersion(version: string): [number, number, number, string] | null {
	const match = version.match(/^(\d+)\.(\d+)\.(\d+)(.*)/);
	if (!match) {
		return null;
	}
	return [Number(match[1]), Number(match[2]), Number(match[3]), match[4]];
}
