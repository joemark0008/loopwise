import { Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { type Job as BossJob, PgBoss, type SendOptions } from 'pg-boss';

import { ConfigService } from '../config/config.service.js';
import { JOB_HANDLER_KEY, type JobHandlerMetadata } from './job.decorator.js';

/** Upstream scheduler semantics: retry backoff 30s → 10m, 10-minute lease. */
export const JOB_DEFAULTS = {
	retryLimit: 5,
	retryDelay: 30,
	retryDelayMax: 600,
	expireInSeconds: 600,
} as const;

type JobHandler = (data: unknown, job: BossJob<object>) => unknown;

interface RegisteredJob {
	metadata: JobHandlerMetadata;
	handler: JobHandler;
}

/**
 * pg-boss on the app database (its own `pgboss` schema). Replaces upstream's `scheduled_job` poller.
 * Starts after every module is initialised, discovers `@Job()` handlers and registers their queues,
 * workers and cron schedules.
 */
@Injectable()
export class JobsService implements OnApplicationBootstrap, OnModuleDestroy {
	private readonly logger = new Logger(JobsService.name);
	private boss: PgBoss | null = null;
	private readonly jobs = new Map<string, RegisteredJob>();

	constructor(
		private readonly config: ConfigService,
		private readonly discovery: DiscoveryService,
		private readonly scanner: MetadataScanner,
		private readonly reflector: Reflector,
	) {}

	async onApplicationBootstrap(): Promise<void> {
		this.discoverHandlers();
		const boss = new PgBoss({ connectionString: this.config.env.DATABASE_URL, schema: 'pgboss' });
		boss.on('error', (error) => this.logger.error(`pg-boss error: ${error.message}`, error.stack));
		await boss.start();
		this.boss = boss;

		for (const job of this.jobs.values()) {
			await this.register(boss, job);
		}
		if (this.jobs.size > 0) {
			this.logger.log(`Registered jobs: ${[...this.jobs.keys()].join(', ')}`);
		}
	}

	async onModuleDestroy(): Promise<void> {
		await this.boss?.stop({ graceful: true, timeout: 10_000 });
		this.boss = null;
	}

	/** Enqueues a job. Returns its id, or null when a singleton job of the same key already exists. */
	send(name: string, data: object = {}, options?: SendOptions): Promise<string | null> {
		return this.getBoss().send(name, data, options);
	}

	/** The running pg-boss instance (for inspection: `findJobs`, `getQueueStats`, …). */
	getBoss(): PgBoss {
		if (!this.boss) {
			throw new Error('pg-boss is not started yet');
		}
		return this.boss;
	}

	private discoverHandlers(): void {
		for (const wrapper of this.discovery.getProviders()) {
			const instance = wrapper.instance as Record<string, unknown> | undefined;
			if (!instance || !wrapper.isDependencyTreeStatic() || typeof instance !== 'object') {
				continue;
			}
			const prototype = Object.getPrototypeOf(instance) as object;
			for (const methodName of this.scanner.getAllMethodNames(prototype)) {
				const method = instance[methodName];
				if (typeof method !== 'function') {
					continue;
				}
				const metadata = this.reflector.get<JobHandlerMetadata | undefined>(JOB_HANDLER_KEY, method);
				if (!metadata) {
					continue;
				}
				if (this.jobs.has(metadata.name)) {
					throw new Error(`Duplicate @Job('${metadata.name}') handler`);
				}
				this.jobs.set(metadata.name, { metadata, handler: (method as JobHandler).bind(instance) });
			}
		}
	}

	private async register(boss: PgBoss, { metadata, handler }: RegisteredJob): Promise<void> {
		const { name } = metadata;
		await boss.createQueue(name, {
			retryLimit: metadata.retryLimit ?? JOB_DEFAULTS.retryLimit,
			retryDelay: metadata.retryDelay ?? JOB_DEFAULTS.retryDelay,
			retryBackoff: true,
			retryDelayMax: metadata.retryDelayMax ?? JOB_DEFAULTS.retryDelayMax,
			expireInSeconds: metadata.expireInSeconds ?? JOB_DEFAULTS.expireInSeconds,
		});

		const workOptions = metadata.pollingIntervalSeconds
			? { pollingIntervalSeconds: metadata.pollingIntervalSeconds }
			: {};
		await boss.work<object>(name, workOptions, async (jobs) => {
			for (const job of jobs) {
				try {
					await handler(job.data, job);
				} catch (error) {
					this.logger.warn(
						`Job ${name} (${job.id}) failed: ${error instanceof Error ? error.message : String(error)}`,
					);
					throw error;
				}
			}
		});

		if (metadata.cron) {
			await boss.schedule(name, metadata.cron, metadata.cronData ?? null, { tz: metadata.tz ?? 'UTC' });
		}
	}
}
