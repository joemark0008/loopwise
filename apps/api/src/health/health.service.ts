import { BeforeApplicationShutdown, Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '../config/config.service.js';
import { HealthRepository } from './health.repository.js';

export interface HealthStatus {
	status: 'ok' | 'error' | 'draining';
	database: 'ok' | 'error';
	version: string;
}

@Injectable()
export class HealthService implements BeforeApplicationShutdown {
	private readonly logger = new Logger(HealthService.name);
	private draining = false;

	constructor(
		private readonly repository: HealthRepository,
		private readonly config: ConfigService,
	) {}

	async check(): Promise<HealthStatus> {
		const version = this.config.env.APP_VERSION;
		let database: HealthStatus['database'] = 'ok';
		try {
			await this.repository.ping();
		} catch (error) {
			this.logger.warn(`Database health check failed: ${error instanceof Error ? error.message : String(error)}`);
			database = 'error';
		}
		const status = this.draining ? 'draining' : database === 'ok' ? 'ok' : 'error';
		return { status, database, version };
	}

	/** Reports unhealthy for SHUTDOWN_DRAIN_DELAY_MS while still serving, so a load balancer can move traffic away. */
	async beforeApplicationShutdown(): Promise<void> {
		const delay = this.config.env.SHUTDOWN_DRAIN_DELAY_MS;
		if (delay <= 0) {
			return;
		}
		this.draining = true;
		await new Promise((resolve) => setTimeout(resolve, delay));
	}
}
