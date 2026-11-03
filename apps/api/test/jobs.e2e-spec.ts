import 'reflect-metadata';

import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ConfigModule } from '../src/config/config.module.js';
import { Job } from '../src/jobs/job.decorator.js';
import { JobsModule } from '../src/jobs/jobs.module.js';
import { JobsService } from '../src/jobs/jobs.service.js';
import { useTestDatabase } from './test-app.js';

const FLAKY_JOB = 'test.flaky';
const CRON_JOB = 'test.nightly';

@Injectable()
class TestJobs {
	readonly attempts: Array<{ data: unknown; at: number }> = [];

	@Job(FLAKY_JOB, { retryLimit: 2, retryDelay: 1, pollingIntervalSeconds: 0.5 })
	async flaky(data: { value: string }) {
		this.attempts.push({ data, at: Date.now() });
		if (this.attempts.length === 1) {
			throw new Error('first attempt fails');
		}
	}

	@Job(CRON_JOB, { cron: '0 3 * * *', cronData: { source: 'cron' } })
	async nightly() {}
}

async function waitFor<T>(check: () => Promise<T | undefined>, timeoutMs = 15_000): Promise<T> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const value = await check();
		if (value !== undefined) {
			return value;
		}
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	throw new Error('Timed out');
}

describe('jobs (pg-boss)', () => {
	let jobs: JobsService;
	let handlers: TestJobs;
	let close: () => Promise<void>;

	beforeAll(async () => {
		useTestDatabase();
		const moduleRef = await Test.createTestingModule({
			imports: [ConfigModule, JobsModule],
			providers: [TestJobs],
		}).compile();
		const app = moduleRef.createNestApplication({ logger: ['error'] });
		await app.init();
		jobs = app.get(JobsService);
		handlers = app.get(TestJobs);
		close = () => app.close();
	});

	afterAll(async () => {
		await close?.();
	});

	it('registers cron schedules for @Job handlers', async () => {
		const schedules = await jobs.getBoss().getSchedules(CRON_JOB);
		expect(schedules).toEqual([
			expect.objectContaining({ name: CRON_JOB, cron: '0 3 * * *', data: { source: 'cron' }, timezone: 'UTC' }),
		]);
	});

	it('runs a sent job and retries it after a failure', async () => {
		const id = await jobs.send(FLAKY_JOB, { value: 'hello' });
		expect(id).toBeTruthy();

		const job = await waitFor(async () => {
			const found = await jobs.getBoss().getJobById(FLAKY_JOB, id!);
			return found?.state === 'completed' ? found : undefined;
		});

		expect(handlers.attempts).toHaveLength(2);
		expect(handlers.attempts.map((attempt) => attempt.data)).toEqual([{ value: 'hello' }, { value: 'hello' }]);
		expect(job.retryCount).toBe(1);
		expect(handlers.attempts[1].at - handlers.attempts[0].at).toBeGreaterThanOrEqual(900);
	});
});
