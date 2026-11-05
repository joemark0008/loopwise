import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, createTestUser, resetDatabase, useTestDatabase } from './test-app.js';

const MODEL_SETTINGS = {
	'claude-sonnet-4-6': { reasoningEffort: 'high' },
	'claude-sonnet-4-5': { temperature: 0.2 },
};

/**
 * Settings → Models on Postgres through GraphQL. The model-settings cases port upstream
 * `tests/clinic-llm-config-model-settings.test.ts` (a SQLite round-trip of the repository); upstream
 * `clinic-llm-config-override.test.ts` covers the `loopwise_config.yaml` `llm` block, which loopwise does not port.
 */
describe('model settings (e2e)', () => {
	let app: NestExpressApplication;
	let cookie: string[] = [];
	let clinicId = '';

	beforeAll(async () => {
		const databaseUrl = useTestDatabase();
		process.env.LOOPWISE_CLINICS_DIR = await mkdtemp(path.join(tmpdir(), 'loopwise-clinics-'));
		await resetDatabase(databaseUrl);
		app = await createTestApp();
		({ cookie } = await createTestUser(app, { name: 'Ada', email: 'ada@example.com', password: 'Sup3r-secret!' }));
		const clinic = await graphql('mutation { createClinic(input: { name: "Models" }) { id } }');
		clinicId = clinic.body.data.createClinic.id;
	});

	afterAll(async () => {
		await app?.close();
	});

	const graphql = (query: string, variables: Record<string, unknown> = {}) =>
		request(app.getHttpServer())
			.post('/graphql')
			.set('Cookie', cookie)
			.set(clinicId ? { 'x-loopwise-clinic-id': clinicId } : {})
			.send({ query, variables });

	const upsert = (input: Record<string, unknown>) =>
		graphql('mutation ($input: JSON!) { upsertLlmConfig(input: $input) }', { input });

	const anthropicConfig = async () => {
		const res = await graphql('{ llmConfigs }');
		return res.body.data.llmConfigs.clinicConfigs.find(
			(config: { provider: string }) => config.provider === 'anthropic',
		);
	};

	it('stores model settings on insert and reads them back, with the key previewed', async () => {
		const res = await upsert({
			provider: 'anthropic',
			apiKey: 'sk-ant-test-key-1234',
			enabledModels: ['claude-sonnet-4-6', 'claude-sonnet-4-5'],
			modelSettings: MODEL_SETTINGS,
		});
		expect(res.body.errors).toBeUndefined();
		expect(res.body.data.upsertLlmConfig).toMatchObject({
			provider: 'anthropic',
			apiKeyPreview: 'sk-ant-t...1234',
			modelSettings: MODEL_SETTINGS,
		});
		expect((await anthropicConfig()).modelSettings).toEqual(MODEL_SETTINGS);
	});

	it('preserves model settings and the stored key when an update omits them', async () => {
		await upsert({ provider: 'anthropic', enabledModels: ['claude-sonnet-4-6', 'claude-sonnet-4-5'] });
		const config = await anthropicConfig();
		expect(config.modelSettings).toEqual(MODEL_SETTINGS);
		expect(config.apiKeyPreview).toBe('sk-ant-t...1234');
	});

	it('replaces model settings when an update provides them, dropping models that are not enabled', async () => {
		const nextSettings = { 'claude-sonnet-4-6': { reasoningEffort: 'low' } };
		await upsert({
			provider: 'anthropic',
			enabledModels: ['claude-sonnet-4-6'],
			modelSettings: { ...nextSettings, 'claude-sonnet-4-5': { temperature: 1 } },
		});
		expect((await anthropicConfig()).modelSettings).toEqual(nextSettings);
	});

	it('refuses a provider that needs a key when none is given or set in the environment', async () => {
		const previous = process.env.MISTRAL_API_KEY;
		delete process.env.MISTRAL_API_KEY;
		const res = await upsert({ provider: 'mistral', enabledModels: [] });
		process.env.MISTRAL_API_KEY = previous;
		expect(res.body.errors[0].extensions.code).toBe('BAD_REQUEST');
		expect(res.body.errors[0].message).toContain('API key is required for mistral');
	});

	it('deletes a provider config', async () => {
		const res = await graphql('mutation { deleteLlmConfig(provider: "anthropic") }');
		expect(res.body.data.deleteLlmConfig).toBe(true);
		expect(await anthropicConfig()).toBeUndefined();
	});

	it('merges agent settings section by section', async () => {
		await graphql('mutation ($input: JSON!) { updateAgentSettings(input: $input) }', {
			input: { webSearch: { enabled: true }, sql: { enforceExcludedColumns: true } },
		});
		await graphql('mutation ($input: JSON!) { updateAgentSettings(input: $input) }', {
			input: { webSearch: { mode: 'provider' }, mapEnabled: false },
		});
		const res = await graphql('{ agentSettings }');
		expect(res.body.data.agentSettings).toMatchObject({
			mapEnabled: false,
			webSearch: { enabled: true, mode: 'provider' },
			sql: { enforceExcludedColumns: true },
			capabilities: { sandbox: false, semanticLayer: false },
		});
	});

	it('rejects agent settings outside upstream limits', async () => {
		const res = await graphql('mutation ($input: JSON!) { updateAgentSettings(input: $input) }', {
			input: { pythonExecution: { maxDurationSecs: 0 } },
		});
		expect(res.body.errors[0].extensions.code).toBe('BAD_REQUEST');
	});

	it('stores the default model settings', async () => {
		const settings = { mode: 'single', single: { provider: 'openai', modelId: 'gpt-4.1-mini' } };
		const res = await graphql('mutation ($settings: JSON!) { updateDefaultModels(settings: $settings) }', {
			settings,
		});
		expect(res.body.data.updateDefaultModels).toEqual(settings);
		const overview = await graphql('{ defaultModels }');
		expect(overview.body.data.defaultModels).toMatchObject({ settings, integrations: [] });
	});
});
