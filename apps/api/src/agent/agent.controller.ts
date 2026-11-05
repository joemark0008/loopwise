import { Readable } from 'node:stream';

import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { JsonToSseTransformStream, UI_MESSAGE_STREAM_HEADERS } from 'ai';
import type { Request, Response } from 'express';

import type { AuthUser } from '../auth/auth.service.js';
import { ClinicRepository } from '../clinics/clinic.repository.js';
import { CurrentUser, SelectedClinicId } from '../common/decorators/current.decorator.js';
import { HandlerError } from '../common/errors/handler-error.js';
import { AgentService } from './agent.service.js';
import { AgentRequestSchema } from './types/chat.js';
import { trackAgentStreamDisconnect } from './utils/agent-stream-disconnect.js';
import { withQueryResultPreviewsInStream } from './utils/query-result-preview.js';
import { withSseKeepAlive } from './utils/sse-keep-alive.js';

const KEEP_ALIVE_INTERVAL_MS = 10_000;

/**
 * Port of upstream `routes/agent.ts`: `POST /api/agent` streams the agent's answer as an AI SDK UI message stream
 * (SSE), which the frontend's `useChat` consumes. When the client goes away the run keeps going and its answer is
 * saved (upstream behaviour: the Stop button stops a run through `stopChat`); the early close is logged.
 */
@Controller('api/agent')
export class AgentController {
	constructor(
		private readonly agentService: AgentService,
		private readonly clinics: ClinicRepository,
	) {}

	@Post()
	async stream(
		@CurrentUser() user: AuthUser,
		@SelectedClinicId() selectedClinicId: string | null,
		@Body() rawBody: unknown,
		@Req() request: Request,
		@Res() response: Response,
	): Promise<void> {
		const parsed = AgentRequestSchema.safeParse(rawBody);
		if (!parsed.success) {
			throw new HandlerError('BAD_REQUEST', parsed.error.issues.map((issue) => issue.message).join('; '));
		}
		const currentClinic = await this.clinics.getClinicByUserId(user.id, selectedClinicId);
		const result = await this.agentService.handleAgentRequest(user.id, currentClinic, parsed.data);

		const sse = trackAgentStreamDisconnect(withQueryResultPreviewsInStream(result.stream), {
			request,
			response,
			agent: result.agent,
			userId: user.id,
			clinicId: currentClinic?.id,
			chatId: result.chatId,
			modelId: result.modelId,
		}).pipeThrough(new JsonToSseTransformStream());

		response.writeHead(200, {
			...UI_MESSAGE_STREAM_HEADERS,
			'x-accel-buffering': 'no',
			'cache-control': 'no-cache, no-transform',
		});
		response.flushHeaders();
		const body = Readable.fromWeb(
			withSseKeepAlive(sse, KEEP_ALIVE_INTERVAL_MS).pipeThrough(new TextEncoderStream()) as never,
		);
		body.pipe(response);
		response.once('close', () => body.destroy());
	}
}
