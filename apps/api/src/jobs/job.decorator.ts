import { SetMetadata } from '@nestjs/common';

export const JOB_HANDLER_KEY = 'loopwise:job';

export interface JobOptions {
	/** Cron expression: the job is scheduled with `boss.schedule()` at boot. */
	cron?: string;
	/** Time zone for `cron` (default UTC). */
	tz?: string;
	/** Data sent with each scheduled run. */
	cronData?: object;
	/** Retries after the first failure (default 5, like upstream's backoff table). */
	retryLimit?: number;
	/** First retry delay in seconds, doubled on each retry (default 30). */
	retryDelay?: number;
	/** Longest retry delay in seconds (default 600). */
	retryDelayMax?: number;
	/** How long a running job keeps its lease before it is retried (default 600, upstream's lease). */
	expireInSeconds?: number;
	/** How often the worker polls when idle, in seconds (pg-boss default 2). */
	pollingIntervalSeconds?: number;
}

export interface JobHandlerMetadata extends JobOptions {
	name: string;
}

/**
 * Marks a provider method as the handler of a pg-boss queue. Handlers are discovered at boot; the
 * method receives the job's data and the job itself. A thrown error fails the job, which is retried
 * with exponential backoff until `retryLimit`.
 */
export const Job = (name: string, options: JobOptions = {}) =>
	SetMetadata<string, JobHandlerMetadata>(JOB_HANDLER_KEY, { name, ...options });
