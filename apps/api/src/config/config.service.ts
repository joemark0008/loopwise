import { Injectable } from '@nestjs/common';

import type { Env } from './env.js';

/** Typed, validated environment. Inject it instead of reading `process.env`. */
@Injectable()
export class ConfigService {
	constructor(readonly env: Env) {}

	get isDev(): boolean {
		return this.env.MODE === 'dev';
	}

	get isTest(): boolean {
		return this.env.MODE === 'test';
	}

	/** Public base URL without a trailing slash. */
	get baseUrl(): string {
		return this.env.BETTER_AUTH_URL.replace(/\/+$/, '');
	}
}
