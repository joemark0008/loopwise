import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { z } from 'zod/v4';

import { ClinicAccess } from '../common/decorators/access.decorator.js';
import { CurrentClinic } from '../common/decorators/current.decorator.js';
import { HandlerError } from '../common/errors/handler-error.js';
import type { Clinic } from '../generated/prisma/client.js';
import { TranscribeService } from './transcribe.service.js';

const transcribeBodySchema = z.object({
	audio: z.string(),
	provider: z.enum(['openai']).optional(),
	modelId: z.string().optional(),
});

/**
 * `POST /api/transcribe` (upstream tRPC `transcribe.transcribe`): base64 audio in, text out. A REST endpoint per
 * PLAN.md §5; the body is upstream's input unchanged.
 */
@Controller('api/transcribe')
export class TranscribeController {
	constructor(private readonly transcribeService: TranscribeService) {}

	@ClinicAccess()
	@Post()
	@HttpCode(200)
	async transcribe(@CurrentClinic() clinic: Clinic, @Body() rawBody: unknown): Promise<{ text: string }> {
		const parsed = transcribeBodySchema.safeParse(rawBody);
		if (!parsed.success) {
			throw new HandlerError('BAD_REQUEST', parsed.error.issues.map((issue) => issue.message).join('; '));
		}
		const { audio, provider, modelId } = parsed.data;
		try {
			return { text: await this.transcribeService.transcribeAudio(clinic.id, audio, { provider, modelId }) };
		} catch (error) {
			if (error instanceof HandlerError) {
				throw error;
			}
			throw new HandlerError('BAD_REQUEST', error instanceof Error ? error.message : 'Transcription failed');
		}
	}
}
