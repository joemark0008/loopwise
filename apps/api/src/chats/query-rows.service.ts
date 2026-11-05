import { type SortDirection, sortTableRows } from '@loopwise/shared/story-table-utils';
import { Injectable } from '@nestjs/common';

import { AgentService } from '../agent/agent.service.js';
import type { QueryResult } from '../agent/types/tools.js';
import { HandlerError } from '../common/errors/handler-error.js';
import { ChatRepository } from './chat.repository.js';
import { ChatAccessService } from './chat-access.service.js';

export interface QueryRowsRequest {
	chatId: string;
	toolCallId: string;
	queryId: string;
	offset: number;
	/** All rows from `offset` when omitted. */
	limit?: number;
	sort?: { column: string; direction: SortDirection };
}

export interface QueryRowsPage {
	columns: string[];
	rows: Record<string, unknown>[];
	totalRows: number;
}

/** Port of upstream `services/query-rows.service.ts` and `chat.getQueryRows`'s access check (`utils/chat-access.ts`). */
@Injectable()
export class QueryRowsService {
	constructor(
		private readonly chats: ChatRepository,
		private readonly chatAccess: ChatAccessService,
		private readonly agents: AgentService,
	) {}

	async getQueryRowsForUser(request: QueryRowsRequest, userId: string): Promise<QueryRowsPage> {
		const clinicId = await this.chats.getActiveChatClinicId(request.chatId);
		if (!clinicId || !(await this.chatAccess.canUserViewChatContent(request.chatId, clinicId, userId))) {
			throw new HandlerError('NOT_FOUND', `Chat with id ${request.chatId} not found.`);
		}
		const page = await this.getQueryRowsPage(request);
		if (!page) {
			throw new HandlerError('NOT_FOUND', `Query ${request.queryId} not found.`);
		}
		return page;
	}

	async getQueryRowsPage(request: QueryRowsRequest): Promise<QueryRowsPage | null> {
		const result = await this.findQueryResult(request.chatId, request.toolCallId, request.queryId);
		if (!result) {
			return null;
		}

		const rows = request.sort
			? sortTableRows(result.data, request.sort.column, request.sort.direction)
			: result.data;
		const end = request.limit === undefined ? undefined : request.offset + request.limit;
		return { columns: result.columns, rows: rows.slice(request.offset, end), totalRows: rows.length };
	}

	/** A query from the turn still running is only in the agent's memory: its part is saved when the turn ends. */
	private async findQueryResult(chatId: string, toolCallId: string, queryId: string): Promise<QueryResult | null> {
		const persisted = await this.chats.getQueryToolOutputInChat(chatId, toolCallId);
		if (persisted?.id === queryId && Array.isArray(persisted.columns) && Array.isArray(persisted.data)) {
			return { columns: persisted.columns, data: persisted.data };
		}
		return this.agents.get(chatId)?.getQueryResult(queryId) ?? null;
	}
}
