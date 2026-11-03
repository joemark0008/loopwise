import { Injectable } from '@nestjs/common';

import type { TokenUsage } from '../agent/types/chat.js';
import type { LlmInferenceType } from '../agent/types/llm.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface NewLlmInference extends TokenUsage {
	type: LlmInferenceType;
	projectId: string;
	userId: string;
	chatId?: string | null;
	llmProvider: string;
	llmModelId: string;
}

/** Port of upstream `queries/llm-inference.ts`. */
@Injectable()
export class LlmInferenceRepository {
	constructor(private readonly prisma: PrismaService) {}

	async insertLlmInference(record: NewLlmInference): Promise<void> {
		await this.prisma.llmInference.create({ data: record });
	}
}
