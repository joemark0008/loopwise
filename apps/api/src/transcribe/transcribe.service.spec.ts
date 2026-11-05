import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClinicLlmConfigRepository } from '../agent/llm/clinic-llm-config.repository.js';

const mocks = vi.hoisted(() => ({
	transcribe: vi.fn(async () => ({ text: 'hello' })),
	createTranscribeModel: vi.fn((provider: string, settings: unknown, modelId: string) => ({
		provider,
		settings,
		modelId,
	})),
}));

vi.mock('ai', () => ({ experimental_transcribe: mocks.transcribe }));
vi.mock('./transcribe.providers.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('./transcribe.providers.js')>()),
	createTranscribeModel: mocks.createTranscribeModel,
}));

import { TranscribeService } from './transcribe.service.js';

const configs = { getAgentSettings: vi.fn(), getClinicLlmConfigByProvider: vi.fn() };
const service = new TranscribeService(configs as unknown as ClinicLlmConfigRepository);

describe('TranscribeService', () => {
	const previousKey = process.env.OPENAI_API_KEY;

	beforeEach(() => {
		vi.clearAllMocks();
		configs.getAgentSettings.mockResolvedValue(null);
		configs.getClinicLlmConfigByProvider.mockResolvedValue(null);
		process.env.OPENAI_API_KEY = 'sk-env';
	});

	afterEach(() => {
		process.env.OPENAI_API_KEY = previousKey;
	});

	it('uses the default OpenAI transcription model and the environment key', async () => {
		await expect(service.transcribeAudio('clinic-1', Buffer.from('audio').toString('base64'))).resolves.toBe(
			'hello',
		);
		expect(mocks.createTranscribeModel).toHaveBeenCalledWith(
			'openai',
			{ apiKey: 'sk-env', baseURL: undefined },
			'gpt-4o-mini-transcribe',
		);
		expect(mocks.transcribe).toHaveBeenCalledWith(expect.objectContaining({ audio: Buffer.from('audio') }));
	});

	it('prefers the model saved in the agent settings, then a per-request override', async () => {
		configs.getAgentSettings.mockResolvedValue({ transcribe: { provider: 'openai', modelId: 'whisper-1' } });
		await service.transcribeAudio('clinic-1', '');
		expect(mocks.createTranscribeModel).toHaveBeenLastCalledWith('openai', expect.anything(), 'whisper-1');

		await service.transcribeAudio('clinic-1', '', { modelId: 'gpt-4o-transcribe' });
		expect(mocks.createTranscribeModel).toHaveBeenLastCalledWith('openai', expect.anything(), 'gpt-4o-transcribe');
	});

	it("uses the clinic's provider config over the environment", async () => {
		configs.getClinicLlmConfigByProvider.mockResolvedValue({ apiKey: 'sk-clinic', baseUrl: 'https://proxy' });
		await service.transcribeAudio('clinic-1', '');
		expect(mocks.createTranscribeModel).toHaveBeenCalledWith(
			'openai',
			{ apiKey: 'sk-clinic', baseURL: 'https://proxy' },
			'gpt-4o-mini-transcribe',
		);
	});

	it('refuses to transcribe without a key', async () => {
		delete process.env.OPENAI_API_KEY;
		await expect(service.transcribeAudio('clinic-1', '')).rejects.toThrow('No API key configured for openai');
		expect(mocks.transcribe).not.toHaveBeenCalled();
	});

	it('lists the transcription models with whether a key is available', async () => {
		const models = await service.listAvailableTranscribeModels('clinic-1');
		expect(models.openai.hasKey).toBe(true);
		expect(models.openai.models[0]).toEqual({
			id: 'gpt-4o-mini-transcribe',
			name: 'GPT-4o Mini Transcribe',
			default: true,
			pricePerMinute: 0.003,
		});

		delete process.env.OPENAI_API_KEY;
		expect((await service.listAvailableTranscribeModels('clinic-1')).openai.hasKey).toBe(false);
	});
});
