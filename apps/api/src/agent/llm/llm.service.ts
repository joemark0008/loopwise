import { Injectable } from '@nestjs/common';
import { type DefaultModelSettings, selectBackgroundModel } from '@quarry/shared';
import { type LlmProvider, type LlmSelectedModel, providerKind } from '@quarry/shared/types';

import type { ManagedAiUsageContext } from '../providers/managed-ai.js';
import {
	createProviderModel,
	getDefaultModelId,
	getProviderMeta,
	LLM_PROVIDERS,
	type ProviderModelResult,
} from '../providers/providers.js';
import type { CustomModelMetadata, ModelSettingsMap, ProviderModelSource, ProviderSettings } from '../types/llm.js';
import { ProjectLlmConfigRepository } from './project-llm-config.repository.js';

/** A project's own credentials for a provider, and its per-model settings. */
interface ProviderAccess {
	settings: ProviderSettings;
	modelSettings?: ModelSettingsMap | null;
}

/**
 * Port of upstream `utils/llm.ts`: which models a project can use and how to reach them. Sources, in order:
 * the project's LLM configs (Settings → Models), then provider keys from the environment (`OPENAI_API_KEY`,
 * `ANTHROPIC_API_KEY`…, `<PROVIDER>_BASE_URL`). Not ported: the `llm` block of `quarry_config.yaml` and the
 * managed provider (billing).
 */
@Injectable()
export class LlmService {
	constructor(private readonly configs: ProjectLlmConfigRepository) {}

	async resolveProviderSettings(projectId: string, provider: LlmProvider): Promise<ProviderSettings | null> {
		return (await this.findAccess(projectId, provider))?.settings ?? null;
	}

	/** `resolveProviderModel`: the model from the first source with credentials for the provider. */
	async resolveProviderModel(
		projectId: string,
		provider: LlmProvider,
		modelId: string,
		applyUserSettings = true,
		_usageContext?: ManagedAiUsageContext,
	): Promise<ProviderModelResult | null> {
		const access = await this.findAccess(projectId, provider);
		if (!access) {
			return null;
		}
		const inferenceSettings = applyUserSettings ? access.modelSettings?.[modelId] : undefined;
		return createProviderModel(provider, access.settings, modelId, inferenceSettings);
	}

	/** The chat default an admin pinned (substituted when unavailable), else the first available model. */
	async resolveDefaultChatModel(projectId: string): Promise<LlmSelectedModel | null> {
		const [settings, available] = await Promise.all([
			this.configs.getDefaultModelSettings(projectId) as Promise<DefaultModelSettings | null>,
			this.getProjectAvailableModels(projectId),
		]);
		if (settings?.chat) {
			return substituteUnavailableModel(available, settings.chat);
		}
		const first = available.at(0);
		return first ? { provider: first.provider, modelId: first.modelId } : null;
	}

	/** `resolveDefaultModelSelection`: the model pinned for a background task (title, memory…). */
	async resolveDefaultModelSelection(
		projectId: string,
		category: Parameters<typeof selectBackgroundModel>[1],
	): Promise<LlmSelectedModel | null> {
		const settings = (await this.configs.getDefaultModelSettings(projectId)) as DefaultModelSettings | null;
		const configured = selectBackgroundModel(settings, category);
		return configured
			? substituteUnavailableModel(await this.getProjectAvailableModels(projectId), configured)
			: null;
	}

	/** `resolveAnnotationModelId`: the model background tasks use when nothing is pinned. */
	async resolveAnnotationModelId(
		projectId: string,
		modelSelection: LlmSelectedModel,
		fallbackModelId: string,
	): Promise<string> {
		const envOverride = process.env.QUARRY_ANNOTATION_MODEL;
		if (envOverride) {
			return envOverride;
		}
		const config = await this.configs.getProjectLlmConfigByProvider(projectId, modelSelection.provider);
		if (config?.baseUrl) {
			return modelSelection.modelId;
		}
		const enabledModels = (config?.enabledModels as string[] | null) ?? [];
		if (enabledModels.length > 0) {
			return enabledModels[0];
		}
		if (!config && getEnvBaseUrl(modelSelection.provider)) {
			return modelSelection.modelId;
		}
		return fallbackModelId;
	}

	/** Upstream `getProjectModelProvider`: a configured anthropic/openai, else the env, else any available model. */
	async getProjectModelProvider(projectId: string): Promise<LlmProvider | undefined> {
		const configured = await this.configs.getConfiguredTaskProvider(projectId);
		if (configured) {
			return configured;
		}
		const envProvider = (['anthropic', 'openai'] as LlmProvider[]).find(hasEnvApiKey);
		return envProvider ?? (await this.getProjectAvailableModels(projectId)).at(0)?.provider;
	}

	async getProjectAvailableModels(
		projectId: string,
	): Promise<Array<{ provider: LlmProvider; modelId: string; name: string; baseUrl: string | null }>> {
		const sources = await this.getProjectModelSources(projectId);
		return sources.flatMap(({ provider, enabledModels, customModels, baseUrl }) => {
			if (enabledModels.length === 0) {
				const modelId = getDefaultModelId(provider);
				return modelId ? [{ provider, modelId, name: getModelName(provider, modelId), baseUrl }] : [];
			}
			return enabledModels.map((modelId) => ({
				provider,
				modelId,
				name:
					customModels.find((model) => model.id === modelId)?.displayName?.trim() ||
					getModelName(provider, modelId),
				baseUrl,
			}));
		});
	}

	async getProjectDeclaredModels(
		projectId: string,
	): Promise<Array<{ provider: LlmProvider; models: CustomModelMetadata[] }>> {
		const sources = await this.getProjectModelSources(projectId);
		return sources.map(({ provider, customModels }) => ({ provider, models: customModels }));
	}

	/** Each provider from the first source that declares it: project configs, then the environment. */
	private async getProjectModelSources(projectId: string): Promise<ProviderModelSource[]> {
		const configs = await this.configs.getProjectLlmConfigs(projectId);
		const collected: ProviderModelSource[] = configs
			.filter((config) => !isProviderDisabled(config.provider as LlmProvider))
			.map((config) => ({
				provider: config.provider as LlmProvider,
				enabledModels: (config.enabledModels as string[] | null) ?? [],
				customModels: (config.customModels as CustomModelMetadata[] | null) ?? [],
				baseUrl: config.baseUrl ?? getEnvBaseUrl(config.provider as LlmProvider) ?? null,
			}));
		for (const provider of getEnvProviders()) {
			if (!collected.some((existing) => existing.provider === provider)) {
				collected.push({
					provider,
					enabledModels: [],
					customModels: [],
					baseUrl: getEnvBaseUrl(provider) ?? null,
				});
			}
		}
		return collected;
	}

	private async findAccess(projectId: string, provider: LlmProvider): Promise<ProviderAccess | null> {
		if (isProviderDisabled(provider)) {
			return null;
		}
		const config = await this.configs.getProjectLlmConfigByProvider(projectId, provider);
		if (config) {
			return {
				settings: {
					apiKey: config.apiKey,
					...(config.baseUrl && { baseURL: config.baseUrl }),
					...(config.credentials && { credentials: config.credentials as Record<string, string> }),
				},
				modelSettings: config.modelSettings as ModelSettingsMap | null,
			};
		}
		if (!hasEnvApiKey(provider)) {
			return null;
		}
		const baseURL = getEnvBaseUrl(provider);
		return { settings: { apiKey: getEnvApiKey(provider) ?? '', ...(baseURL && { baseURL }) } };
	}
}

/** `getEnvApiKey`. */
export function getEnvApiKey(provider: LlmProvider): string | undefined {
	const { envVar } = getProviderMeta(provider);
	return envVar ? process.env[envVar] : undefined;
}

/** `getEnvBaseUrl` (e.g. `OPENAI_BASE_URL`). */
export function getEnvBaseUrl(provider: LlmProvider): string | undefined {
	const { baseUrlEnvVar } = getProviderMeta(provider);
	return baseUrlEnvVar ? process.env[baseUrlEnvVar] : undefined;
}

/** `isProviderDisabled`: `DISABLED_PROVIDERS` lists provider ids or kinds. */
export function isProviderDisabled(provider: LlmProvider): boolean {
	const disabled = (process.env.DISABLED_PROVIDERS ?? '')
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean);
	return disabled.includes(provider) || disabled.includes(providerKind(provider));
}

/** `hasEnvApiKey`. */
export function hasEnvApiKey(provider: LlmProvider): boolean {
	if (isProviderDisabled(provider)) {
		return false;
	}
	if (getEnvApiKey(provider)) {
		return true;
	}
	const { alternativeEnvVars, extraFields, apiKey } = getProviderMeta(provider).auth;
	if (alternativeEnvVars?.some((bundle) => bundle.every((name) => process.env[name]))) {
		return true;
	}
	return apiKey === 'none' && Boolean(extraFields?.some((field) => process.env[field.envVar]));
}

export function getEnvProviders(): LlmProvider[] {
	return (Object.keys(LLM_PROVIDERS) as LlmProvider[]).filter(hasEnvApiKey);
}

/** `getEnvBaseUrls`: base URLs set via environment, keyed by provider. */
export function getEnvBaseUrls(): Record<string, string> {
	return Object.fromEntries(
		getEnvProviders()
			.map((provider) => [provider, getEnvBaseUrl(provider)] as const)
			.filter((entry): entry is [LlmProvider, string] => Boolean(entry[1])),
	);
}

function getModelName(provider: LlmProvider, modelId: string): string {
	return getProviderMeta(provider).models.find((model) => model.id === modelId)?.name ?? modelId;
}

function substituteUnavailableModel(
	available: Array<{ provider: LlmProvider; modelId: string }>,
	configured: LlmSelectedModel,
): LlmSelectedModel | null {
	if (available.length === 0) {
		return null;
	}
	if (available.some((model) => model.provider === configured.provider && model.modelId === configured.modelId)) {
		return configured;
	}
	const substitute = available.find((model) => model.provider === configured.provider) ?? available[0];
	return { provider: substitute.provider, modelId: substitute.modelId };
}
