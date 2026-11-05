import type { Request, Response } from 'express';

import type { AgentManager } from '../agent-manager.js';
import { logger } from './logger.js';

interface AgentStreamDisconnectContext {
	request: Pick<Request, 'headers'>;
	/** The Express response the SSE stream is written to (upstream: Fastify's `reply.raw`). */
	response: Pick<Response, 'once' | 'writableFinished'>;
	agent: Pick<AgentManager, 'isStopped' | 'waitUntilFinished'>;
	userId: string;
	clinicId: string | undefined;
	chatId: string;
	modelId: string;
}

interface DisconnectTimings {
	startedAt: number;
	lastChunkAt: number;
	closedAt: number;
}

/**
 * Logs when the connection of an agent stream closes before the response is complete, e.g. a proxy
 * idle timeout or a network drop. The Stop button also closes the connection before the stop request
 * reaches the agent, so the decision waits for the run to end and skips runs the user stopped.
 */
export function trackAgentStreamDisconnect<T>(
	stream: ReadableStream<T>,
	context: AgentStreamDisconnectContext,
): ReadableStream<T> {
	const startedAt = Date.now();
	let lastChunkAt = startedAt;

	context.response.once('close', () => {
		if (!context.response.writableFinished) {
			void logUnlessStoppedByUser(context, { startedAt, lastChunkAt, closedAt: Date.now() });
		}
	});

	return stream.pipeThrough(
		new TransformStream<T, T>({
			transform(chunk, controller) {
				lastChunkAt = Date.now();
				controller.enqueue(chunk);
			},
		}),
	);
}

async function logUnlessStoppedByUser(context: AgentStreamDisconnectContext, timings: DisconnectTimings) {
	await context.agent.waitUntilFinished();
	if (context.agent.isStopped) {
		return;
	}

	const { request } = context;
	logger.error('Agent stream connection closed before the response was complete', {
		source: 'agent',
		clinicId: context.clinicId,
		context: {
			chatId: context.chatId,
			userId: context.userId,
			modelId: context.modelId,
			streamDurationSeconds: toSeconds(timings.closedAt - timings.startedAt),
			secondsSinceLastChunk: toSeconds(timings.closedAt - timings.lastChunkAt),
			runFinishedSecondsAfterDisconnect: toSeconds(Date.now() - timings.closedAt),
			userAgent: request.headers['user-agent'],
			host: request.headers['x-forwarded-host'] || request.headers.host,
		},
	});
}

function toSeconds(milliseconds: number): number {
	return Math.round(milliseconds / 100) / 10;
}
