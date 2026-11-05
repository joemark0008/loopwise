import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EnvValidationError, parseEnv } from '../../config/env.js';
import type { ClinicLlmConfigRepository } from './clinic-llm-config.repository.js';
import { getEnvProviders, hasEnvApiKey, isProviderDisabled, LlmService } from './llm.service.js';

/**
 * Ports of upstream `tests/disabled-providers.test.ts`, `tests/annotation-model.test.ts` and
 * `tests/clinic-available-models.test.ts` (the parts covering `utils/llm.ts`). Upstream's query modules
 * are replaced by a mocked `ClinicLlmConfigRepository`. Loopwise drops the managed `loopwise` provider (billing)
 * and the `llm` block of `loopwise_config.yaml`, so the cases about those are not ported.
 */
const mocks = vi.hoisted(() => ({
	getClinicLlmConfigs: vi.fn(),
	getClinicLlmConfigByProvider: vi.fn(),
	getDefaultModelSettings: vi.fn(),
}));

const llm = new LlmService(mocks as unknown as ClinicLlmConfigRepository);

const BASE_ENV = { DATABASE_URL: 'postgresql://localhost/loopwise' };

function parseDisabledProviders(value: string): string[] {
	return parseEnv({ ...BASE_ENV, DISABLED_PROVIDERS: value }).DISABLED_PROVIDERS;
}

describe('DISABLED_PROVIDERS', () => {
	let originalEnv: typeof process.env;

	beforeEach(() => {
		originalEnv = { ...process.env };
		vi.clearAllMocks();
		mocks.getClinicLlmConfigByProvider.mockResolvedValue(null);
		mocks.getClinicLlmConfigs.mockResolvedValue([]);
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	function setDisabledProviders(value: string | undefined) {
		if (value === undefined) {
			delete process.env.DISABLED_PROVIDERS;
		} else {
			process.env.DISABLED_PROVIDERS = value;
		}
	}

	it('defaults to an empty list', () => {
		setDisabledProviders(undefined);
		expect(parseEnv(BASE_ENV).DISABLED_PROVIDERS).toEqual([]);
		expect(isProviderDisabled('bedrock')).toBe(false);
	});

	it('parses a comma-separated list, ignoring whitespace and empty entries', () => {
		setDisabledProviders(' bedrock , vertex ,');
		expect(parseDisabledProviders(' bedrock , vertex ,')).toEqual(['bedrock', 'vertex']);
		expect(isProviderDisabled('bedrock')).toBe(true);
		expect(isProviderDisabled('vertex')).toBe(true);
		expect(isProviderDisabled('anthropic')).toBe(false);
	});

	it('rejects unknown provider ids', () => {
		expect(() => parseDisabledProviders('bedrock,not-a-provider')).toThrow(EnvValidationError);
		expect(() => parseDisabledProviders('bedrock,not-a-provider')).toThrow(/DISABLED_PROVIDERS/);
	});

	it('rejects malformed named-instance ids', () => {
		expect(() => parseDisabledProviders('openaiCompatible/Bad_Name')).toThrow(/DISABLED_PROVIDERS/);
		expect(() => parseDisabledProviders('anthropic/some-name')).toThrow(/DISABLED_PROVIDERS/);
	});

	it('disabling a kind covers its named instances, and an instance can be disabled alone', () => {
		setDisabledProviders('openaiCompatible');
		expect(isProviderDisabled('openaiCompatible/my-vllm')).toBe(true);

		setDisabledProviders('openaiCompatible/my-vllm');
		expect(isProviderDisabled('openaiCompatible/my-vllm')).toBe(true);
		expect(isProviderDisabled('openaiCompatible/other')).toBe(false);
		expect(isProviderDisabled('openaiCompatible')).toBe(false);
	});

	it('keeps a disabled provider from auto-registering off ambient credentials', () => {
		process.env.AWS_WEB_IDENTITY_TOKEN_FILE = '/var/run/secrets/token';
		setDisabledProviders(undefined);
		expect(hasEnvApiKey('bedrock')).toBe(true);
		expect(getEnvProviders()).toContain('bedrock');

		setDisabledProviders('bedrock');
		expect(hasEnvApiKey('bedrock')).toBe(false);
		expect(getEnvProviders()).not.toContain('bedrock');
	});

	it('overrides credentials configured in the database', async () => {
		mocks.getClinicLlmConfigByProvider.mockResolvedValue({
			apiKey: 'db-key',
			baseUrl: null,
			credentials: null,
			modelSettings: {},
		});
		setDisabledProviders(undefined);
		expect(await llm.resolveProviderSettings('clinic-1', 'bedrock')).not.toBeNull();

		setDisabledProviders('bedrock');
		expect(await llm.resolveProviderSettings('clinic-1', 'bedrock')).toBeNull();
	});
});

describe('resolveAnnotationModelId', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getClinicLlmConfigByProvider.mockResolvedValue(null);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('uses the active model for a provider with a custom base URL', async () => {
		mocks.getClinicLlmConfigByProvider.mockResolvedValue({
			baseUrl: 'http://litellm.test/v1',
			enabledModels: ['gpt-4.1-mini', 'gpt-5.5'],
		});

		const modelId = await llm.resolveAnnotationModelId(
			'clinic-1',
			{ provider: 'openai', modelId: 'gpt-5.5' },
			'gpt-4.1-mini',
		);

		expect(modelId).toBe('gpt-5.5');
	});

	it('keeps the configured annotation model for a provider without a custom base URL', async () => {
		mocks.getClinicLlmConfigByProvider.mockResolvedValue({
			baseUrl: null,
			enabledModels: ['gpt-4.1-mini', 'gpt-5.5'],
		});

		const modelId = await llm.resolveAnnotationModelId(
			'clinic-1',
			{ provider: 'openai', modelId: 'gpt-5.5' },
			'gpt-4.1-mini',
		);

		expect(modelId).toBe('gpt-4.1-mini');
	});

	it('uses the active model when the provider base URL comes from the environment', async () => {
		vi.stubEnv('OPENAI_BASE_URL', 'http://litellm.test/v1');

		const modelId = await llm.resolveAnnotationModelId(
			'clinic-1',
			{ provider: 'openai', modelId: 'gpt-5.5' },
			'gpt-4.1-mini',
		);

		expect(modelId).toBe('gpt-5.5');
	});
});

// Upstream's `getClinicAvailableModels` cases are not ported: the managed `loopwise` provider (credits, BYOK alongside
// curated models) is dropped, and loopwise does not read named openai-compatible endpoints from loopwise_config.yaml.
