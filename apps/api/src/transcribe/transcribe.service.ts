import { Injectable } from '@nestjs/common';
import { experimental_transcribe as transcribe } from 'ai';

import { ClinicLlmConfigRepository } from '../agent/llm/clinic-llm-config.repository.js';
import { getEnvApiKey } from '../agent/llm/llm.service.js';
import type { AgentSettings } from '../agent/types/agent-settings.js';
import { TranscriptionDisabledError } from './transcribe.errors.js';
import {
	createTranscribeModel,
	getDefaultTranscribeModelId,
	TRANSCRIBE_PROVIDERS,
	type TranscribeProvider,
} from './transcribe.providers.js';

/** Port of upstream `services/transcribe.service.ts`: speech to text with the clinic's provider key. */
@Injectable()
export class TranscribeService {
	constructor(private readonly configs: ClinicLlmConfigRepository) {}

	/**
	 * Refuses while the clinic's Transcription switch (`agentSettings.transcribe.enabled`, off by default) is off. Every
	 * transcription checks it here, the chat's and the AI scribe's; the scribe also calls it before it audits the export.
	 */
	async assertEnabled(clinicId: string): Promise<AgentSettings | null> {
		const agentSettings = (await this.configs.getAgentSettings(clinicId)) as AgentSettings | null;
		if (agentSettings?.transcribe?.enabled !== true) {
			throw new TranscriptionDisabledError();
		}
		return agentSettings;
	}

	async transcribeAudio(
		clinicId: string,
		audio: string,
		overrides?: { provider?: TranscribeProvider; modelId?: string },
	): Promise<string> {
		const agentSettings = await this.assertEnabled(clinicId);
		const savedProvider = agentSettings?.transcribe?.provider as TranscribeProvider | undefined;
		const savedModelId = agentSettings?.transcribe?.modelId;

		const provider: TranscribeProvider = overrides?.provider ?? savedProvider ?? 'openai';
		const modelId = overrides?.modelId ?? savedModelId ?? getDefaultTranscribeModelId(provider);

		const { apiKey, baseURL } = await this.resolveProviderSettings(clinicId, provider);
		if (!apiKey) {
			throw new Error(`No API key configured for ${provider}. Add one in Settings > Models.`);
		}

		const model = createTranscribeModel(provider, { apiKey, baseURL }, modelId);
		const result = await transcribe({ model, audio: Buffer.from(audio, 'base64') });
		return result.text;
	}

	async listAvailableTranscribeModels(clinicId: string) {
		const available: Record<
			string,
			{
				models: Array<{ id: string; name: string; default?: boolean; pricePerMinute?: number }>;
				hasKey: boolean;
			}
		> = {};

		for (const [provider, config] of Object.entries(TRANSCRIBE_PROVIDERS)) {
			const llmProvider = provider as 'openai';
			const dbConfig = await this.configs.getClinicLlmConfigByProvider(clinicId, llmProvider);
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
		clinicId: string,
		provider: TranscribeProvider,
	): Promise<{ apiKey: string | undefined; baseURL: string | undefined }> {
		const llmProvider = provider as 'openai';
		const config = await this.configs.getClinicLlmConfigByProvider(clinicId, llmProvider);
		if (config) {
			return { apiKey: config.apiKey, baseURL: config.baseUrl ?? undefined };
		}
		return { apiKey: getEnvApiKey(llmProvider), baseURL: undefined };
	}
}
