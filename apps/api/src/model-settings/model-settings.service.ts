import { BACKGROUND_MODEL_CATEGORIES, type BackgroundModelCategory, type DefaultModelSettings } from '@loopwise/shared';
import {
	type LlmProvider,
	type LlmSelectedModel,
	MAX_PYTHON_EXECUTION_DURATION_SECS,
	MIN_PYTHON_EXECUTION_DURATION_SECS,
	SEMANTIC_LAYER_MODES,
} from '@loopwise/shared/types';
import { Injectable } from '@nestjs/common';
import { z } from 'zod/v4';

import { ClinicLlmConfigRepository } from '../agent/llm/clinic-llm-config.repository.js';
import { getEnvApiKey, getEnvBaseUrls, getEnvProviders, LlmService } from '../agent/llm/llm.service.js';
import {
	getDefaultModelId,
	getProviderAuth,
	getProviderMeta,
	isManagedProvider,
	KNOWN_MODELS,
} from '../agent/providers/provider-meta.js';
import type { AgentSettings } from '../agent/types/agent-settings.js';
import {
	customModelMetadataSchema,
	llmProviderSchema,
	llmSelectedModelSchema,
	modelSettingsMapSchema,
} from '../agent/types/llm.js';
import { extractConfiguredSemanticLayer } from '../agent/utils/loopwise-config.js';
import { buildCredentialPreviews, previewApiKey } from '../agent/utils/utils.js';
import { HandlerError } from '../common/errors/handler-error.js';
import type { Clinic, ClinicLlmConfig, Prisma } from '../generated/prisma/client.js';

const backgroundModelSelectionSchema = z.object({ provider: llmProviderSchema, modelId: z.string().min(1) });

const backgroundModelCategoriesSchema = z.object(
	Object.fromEntries(
		BACKGROUND_MODEL_CATEGORIES.map((category) => [category, backgroundModelSelectionSchema.optional()]),
	) as Record<(typeof BACKGROUND_MODEL_CATEGORIES)[number], z.ZodOptional<typeof backgroundModelSelectionSchema>>,
);

export const defaultModelSettingsSchema = z.object({
	mode: z.enum(['single', 'perCategory']),
	chat: backgroundModelSelectionSchema.optional(),
	single: backgroundModelSelectionSchema.optional(),
	categories: backgroundModelCategoriesSchema.optional(),
});

export const upsertLlmConfigSchema = z.object({
	provider: llmProviderSchema,
	apiKey: z.string().min(1).optional(),
	credentials: z.record(z.string(), z.string()).optional(),
	enabledModels: z.array(z.string()).optional(),
	customModels: z.array(customModelMetadataSchema).optional(),
	modelSettings: modelSettingsMapSchema.optional(),
	baseUrl: z.url().optional().or(z.literal('')),
});

export const updateAgentSettingsSchema = z.object({
	experimental: z.object({ pythonSandboxing: z.boolean().optional(), sandboxes: z.boolean().optional() }).optional(),
	mapEnabled: z.boolean().optional(),
	transcribe: z
		.object({ enabled: z.boolean().optional(), provider: z.string().optional(), modelId: z.string().optional() })
		.optional(),
	sql: z
		.object({
			dangerouslyWritePermEnabled: z.boolean().optional(),
			enforceExcludedColumns: z.boolean().optional(),
		})
		.optional(),
	pythonExecution: z
		.object({
			maxDurationSecs: z
				.number()
				.int()
				.min(MIN_PYTHON_EXECUTION_DURATION_SECS)
				.max(MAX_PYTHON_EXECUTION_DURATION_SECS)
				.optional(),
		})
		.optional(),
	memoryEnabled: z.boolean().optional(),
	webSearch: z.object({ enabled: z.boolean().optional(), mode: z.enum(['provider']).optional() }).optional(),
	semanticLayer: z.object({ mode: z.enum(SEMANTIC_LAYER_MODES).optional() }).optional(),
	subagent: z.object({ model: llmSelectedModelSchema.nullable().optional() }).optional(),
});

interface ResolvedDefaultModel extends LlmSelectedModel {
	name: string;
}

type AvailableModel = Awaited<ReturnType<LlmService['getClinicAvailableModels']>>[number];

/**
 * Port of the model and agent settings procedures of upstream `trpc/clinic.routes.ts` (`getLlmConfigs`,
 * `upsertLlmConfig`, `deleteLlmConfig`, `getKnownModels`, `getDefaultModels`, `updateDefaultModels`,
 * `getDefaultChatModel`, `getAgentSettings`, `updateAgentSettings`) and of `services/default-models.service.ts`.
 * Not ported: the `llm` block of `loopwise_config.yaml` (no `configProviders`), messaging integrations (Phase 7, so no
 * integration models) and the MCP endpoint (Phase 6).
 */
@Injectable()
export class ModelSettingsService {
	constructor(
		private readonly configs: ClinicLlmConfigRepository,
		private readonly llm: LlmService,
	) {}

	async getLlmConfigs(clinicId: string) {
		const configs = await this.configs.getClinicLlmConfigs(clinicId);
		return {
			clinicConfigs: configs.map((config) => ({
				...toLlmConfig(config),
				createdAt: config.createdAt,
				updatedAt: config.updatedAt,
			})),
			configProviders: [],
			envProviders: getEnvProviders(),
			envBaseUrls: getEnvBaseUrls(),
		};
	}

	async upsertLlmConfig(clinicId: string, rawInput: unknown) {
		const input = parse(upsertLlmConfigSchema, rawInput);
		if (isManagedProvider(input.provider)) {
			throw new HandlerError('BAD_REQUEST', 'The managed provider is configured by Loopwise.');
		}
		const existingConfig = await this.configs.getClinicLlmConfigByProvider(clinicId, input.provider);
		const envApiKey = getEnvApiKey(input.provider);

		const hasNewCredentials = Object.values(input.credentials ?? {}).some(Boolean);
		const credentials = hasNewCredentials
			? { ...(existingConfig?.credentials as Record<string, string> | null), ...input.credentials }
			: undefined;

		let apiKey: string | null;
		if (input.apiKey) {
			apiKey = input.apiKey;
		} else if (hasNewCredentials) {
			apiKey = '';
		} else if (existingConfig) {
			apiKey = null;
		} else if (envApiKey) {
			apiKey = envApiKey;
		} else if (getProviderAuth(input.provider).apiKey !== 'required') {
			apiKey = '';
		} else {
			throw new HandlerError(
				'BAD_REQUEST',
				`API key is required for ${input.provider}. Provide one or set it as an environment variable.`,
			);
		}

		const enabledModels = input.enabledModels ?? [];
		const customModels = (input.customModels ?? []).filter((model) => enabledModels.includes(model.id));
		const modelSettings = input.modelSettings
			? Object.fromEntries(
					Object.entries(input.modelSettings).filter(([modelId]) => enabledModels.includes(modelId)),
				)
			: undefined;

		const config = await this.configs.upsertClinicLlmConfig({
			clinicId,
			provider: input.provider,
			apiKey,
			credentials: credentials as Prisma.InputJsonValue | undefined,
			enabledModels,
			customModels: customModels as Prisma.InputJsonValue,
			modelSettings: modelSettings as Prisma.InputJsonValue | undefined,
			baseUrl: input.baseUrl || null,
		});
		return toLlmConfig(config);
	}

	async deleteLlmConfig(clinicId: string, provider: unknown): Promise<void> {
		await this.configs.deleteClinicLlmConfig(clinicId, parse(llmProviderSchema, provider));
	}

	getKnownModels() {
		return KNOWN_MODELS;
	}

	/** Upstream `getDefaultModels`: the overview, with no messaging integrations or MCP endpoint yet. */
	async getDefaultModels(clinicId: string) {
		return {
			...(await this.getDefaultModelsOverview(clinicId)),
			integrations: [],
			mcpEndpointEnabled: false,
			mcpSubAgentModel: null,
		};
	}

	async updateDefaultModels(clinicId: string, rawSettings: unknown): Promise<DefaultModelSettings> {
		const settings = parse(defaultModelSettingsSchema, rawSettings) as DefaultModelSettings;
		await this.configs.updateDefaultModelSettings(clinicId, settings as unknown as Prisma.InputJsonValue);
		return settings;
	}

	getAvailableModels(clinicId: string) {
		return this.llm.getClinicAvailableModels(clinicId);
	}

	getDefaultChatModel(clinicId: string): Promise<LlmSelectedModel | null> {
		return this.llm.resolveDefaultChatModel(clinicId);
	}

	async getAgentSettings(clinic: Clinic) {
		const settings = (await this.configs.getAgentSettings(clinic.id)) as AgentSettings | null;
		return {
			...settings,
			capabilities: {
				pythonSandbox: false,
				sandbox: false,
				semanticLayer: clinic.path ? extractConfiguredSemanticLayer(clinic.path) !== null : false,
			},
		};
	}

	/** Upstream's route merges each section into the stored settings, then `updateAgentSettings` merges again. */
	async updateAgentSettings(clinicId: string, rawInput: unknown): Promise<AgentSettings> {
		const input = parse(updateAgentSettingsSchema, rawInput);
		const existing = ((await this.configs.getAgentSettings(clinicId)) as AgentSettings | null) ?? {};
		const merged: AgentSettings = {
			memoryEnabled: input.memoryEnabled ?? existing.memoryEnabled,
			mapEnabled: input.mapEnabled ?? existing.mapEnabled,
			experimental: { ...existing.experimental, ...input.experimental },
			transcribe: { ...existing.transcribe, ...input.transcribe },
			sql: { ...existing.sql, ...input.sql },
			pythonExecution: { ...existing.pythonExecution, ...input.pythonExecution },
			webSearch: { ...existing.webSearch, ...input.webSearch },
			semanticLayer: { ...existing.semanticLayer, ...input.semanticLayer },
			subagent: { ...existing.subagent, ...input.subagent },
		} as AgentSettings;
		const next: AgentSettings = {
			...existing,
			...merged,
			experimental: { ...existing.experimental, ...merged.experimental },
			webSearch: { ...existing.webSearch, ...merged.webSearch },
			pythonExecution: { ...existing.pythonExecution, ...merged.pythonExecution },
			subagent: { ...existing.subagent, ...merged.subagent },
		};
		await this.configs.updateAgentSettings(clinicId, next as unknown as Prisma.InputJsonValue);
		return next;
	}

	/** Port of upstream `getDefaultModelsOverview`: settings and catalog loaded once, every default derived. */
	private async getDefaultModelsOverview(clinicId: string) {
		const [settings, availableModels] = await Promise.all([
			this.configs.getDefaultModelSettings(clinicId) as Promise<DefaultModelSettings | null>,
			this.llm.getClinicAvailableModels(clinicId),
		]);
		const chat = await this.llm.resolveDefaultChatModel(clinicId);
		const named = (selection: LlmSelectedModel): ResolvedDefaultModel => ({
			...selection,
			name: nameModel(availableModels, selection),
		});
		return {
			settings,
			availableModels,
			chatModel: chat ? named(chat) : null,
			builtInDefaults: {
				chat: availableModels.length > 0 ? named(availableModels[0]) : null,
				categories: chat ? await this.resolveBuiltInTaskModels(clinicId, chat, named) : {},
			},
		};
	}

	/** Upstream `resolveBuiltInTaskModels`: what each background task falls back to when nothing is pinned. */
	private async resolveBuiltInTaskModels(
		clinicId: string,
		chat: LlmSelectedModel,
		named: (selection: LlmSelectedModel) => ResolvedDefaultModel,
	): Promise<Partial<Record<BackgroundModelCategory, ResolvedDefaultModel>>> {
		const taskProvider = await this.llm.getClinicModelProvider(clinicId);
		const annotationModel = async (fallbackModelId: string): Promise<LlmSelectedModel> => ({
			provider: chat.provider,
			modelId: await this.llm.resolveAnnotationModelId(clinicId, chat, fallbackModelId),
		});
		const [title, extractor] = await Promise.all([
			taskProvider
				? { provider: taskProvider, modelId: getProviderMeta(taskProvider).summaryModelId }
				: annotationModel(getProviderMeta(chat.provider).summaryModelId),
			annotationModel(getProviderMeta(chat.provider).extractorModelId),
		]);
		return {
			...(taskProvider && {
				live_story: named({ provider: taskProvider, modelId: getDefaultModelId(taskProvider) }),
			}),
			title: named(title),
			compaction: named(extractor),
			context_recommendation: named(chat),
			other: named(extractor),
		};
	}
}

function toLlmConfig(config: ClinicLlmConfig) {
	return {
		id: config.id,
		provider: config.provider as LlmProvider,
		apiKeyPreview: previewApiKey(config.apiKey),
		credentialPreviews: buildCredentialPreviews(config.credentials as Record<string, string> | null),
		enabledModels: config.enabledModels ?? [],
		customModels: (config.customModels as unknown[] | null) ?? [],
		modelSettings: (config.modelSettings as Record<string, unknown> | null) ?? {},
		baseUrl: config.baseUrl ?? null,
	};
}

/** Names a model the way the picker does, falling back to the catalogue for models the clinic does not list. */
function nameModel(availableModels: AvailableModel[], { provider, modelId }: LlmSelectedModel): string {
	const listed = availableModels.find((model) => model.provider === provider && model.modelId === modelId);
	return listed?.name ?? getProviderMeta(provider).models.find((model) => model.id === modelId)?.name ?? modelId;
}

function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
	const result = schema.safeParse(value);
	if (!result.success) {
		throw new HandlerError('BAD_REQUEST', result.error.issues.map((issue) => issue.message).join('; '));
	}
	return result.data;
}
