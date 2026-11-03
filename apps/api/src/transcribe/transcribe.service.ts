import { Injectable } from '@nestjs/common';
import { experimental_transcribe as transcribe } from 'ai';

import { getEnvApiKey } from '../agent/llm/llm.service.js';
import { ProjectLlmConfigRepository } from '../agent/llm/project-llm-config.repository.js';
import type { AgentSettings } from '../agent/types/agent-settings.js';
import {
	createTranscribeModel,
	getDefaultTranscribeModelId,
	TRANSCRIBE_PROVIDERS,
	type TranscribeProvider,
} from './transcribe.providers.js';

/** Port of upstream `services/transcribe.service.ts`: speech to text with the project's provider key. */
@Injectable()
export class TranscribeService {
	constructor(private readonly configs: ProjectLlmConfigRepository) {}

	async transcribeAudio(
		projectId: string,
		audio: string,
		overrides?: { provider?: TranscribeProvider; modelId?: string },
	): Promise<string> {
		const agentSettings = (await this.configs.getAgentSettings(projectId)) as AgentSettings | null;
		const savedProvider = agentSettings?.transcribe?.provider as TranscribeProvider | undefined;
		const savedModelId = agentSettings?.transcribe?.modelId;

		const provider: TranscribeProvider = overrides?.provider ?? savedProvider ?? 'openai';
		const modelId = overrides?.modelId ?? savedModelId ?? getDefaultTranscribeModelId(provider);

		const { apiKey, baseURL } = await this.resolveProviderSettings(projectId, provider);
		if (!apiKey) {
			throw new Error(`No API key configured for ${provider}. Add one in Settings > Models.`);
		}

		const model = createTranscribeModel(provider, { apiKey, baseURL }, modelId);
		const result = await transcribe({ model, audio: Buffer.from(audio, 'base64') });
		return result.text;
	}

	async listAvailableTranscribeModels(projectId: string) {
		const available: Record<
			string,
			{
				models: Array<{ id: string; name: string; default?: boolean; pricePerMinute?: number }>;
				hasKey: boolean;
			}
		> = {};

		for (const [provider, config] of Object.entries(TRANSCRIBE_PROVIDERS)) {
			const llmProvider = provider as 'openai';
			const dbConfig = await this.configs.getProjectLlmConfigByProvider(projectId, llmProvider);
			const hasKey = !!(dbConfig?.apiKey || getEnvApiKey(llmProvider));
			available[provider] = {
				models: config.models.map((model) => ({
					id: model.id,
					name: model.name,
					...(model.default && { default: model.default }),
					...(model.pricePerMinute != null && { pricePerMinute: model.pricePerMinute }),
				})),
				hasKey,
			};
		}

		return available;
	}

	private async resolveProviderSettings(
		projectId: string,
		provider: TranscribeProvider,
	): Promise<{ apiKey: string | undefined; baseURL: string | undefined }> {
		const llmProvider = provider as 'openai';
		const config = await this.configs.getProjectLlmConfigByProvider(projectId, llmProvider);
		if (config) {
			return { apiKey: config.apiKey, baseURL: config.baseUrl ?? undefined };
		}
		return { apiKey: getEnvApiKey(llmProvider), baseURL: undefined };
	}
}
