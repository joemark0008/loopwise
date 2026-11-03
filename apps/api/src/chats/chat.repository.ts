import { randomUUID } from 'node:crypto';

import { isQueryToolAgentName, QUERY_TOOL_NAME_PREFIX } from '@loopwise/shared/query-tools';
import { executeSemanticQuery, executeSql, savedQueryTool } from '@loopwise/shared/tools';
import type { CitationData, LlmProvider } from '@loopwise/shared/types';
import { Injectable } from '@nestjs/common';

import type {
	ForkMetadata,
	MessageVersionInfo,
	StopReason,
	TokenUsage,
	UIChat,
	UIMessage,
	UIMessagePart,
} from '../agent/types/chat.js';
import type { NewMessagePart } from '../agent/types/db.js';
import type { StoredQueryPart } from '../agent/types/tools.js';
import { convertDBPartToUIPart, mapUIPartsToDBParts } from '../agent/utils/chat-message-part-mappings.js';
import {
	EXECUTE_SEMANTIC_QUERY_TOOL_NAME,
	EXECUTE_SQL_TOOL_NAME,
	QUERY_RESULT_TOOL_NAME_SQL,
	QUERY_TOOL_NAMES,
} from '../agent/utils/query-tools.js';
import { getErrorMessage } from '../agent/utils/utils.js';
import {
	type Chat,
	type ChatMessage,
	type MessageFeedback,
	type MessagePart,
	Prisma,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DbExecutor } from '../prisma/prisma.types.js';

type MessageWithParts = ChatMessage & { messageParts: MessagePart[]; messageFeedback?: MessageFeedback | null };

/** A stored query read back as SQL (upstream `StoredSqlQuery` of `execute-sql.queries`). */
export type StoredSqlQuery = { sqlQuery: string; databaseId?: string; dialect?: string; adminMode: boolean };

/** Columns of an own chat in the sidebar list (upstream `listOwnChats` / `listSharedWithMeChats`). */
export interface ChatListRow {
	id: string;
	title: string;
	isStarred: boolean;
	isOnboarding: boolean;
	createdAt: number;
	updatedAt: number;
	kind: 'own' | 'shared';
	shareId?: string;
	projectId: string;
	projectName: string;
	isSharedByMe: boolean;
	ownerName: string;
	sourcePlatform: string;
}

export interface SearchChatResult {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	matchedText?: string;
}

/** Port of upstream `queries/chat.queries.ts` and the query lookups of `queries/execute-sql.queries.ts`. */
@Injectable()
export class ChatRepository {
	constructor(private readonly prisma: PrismaService) {}

	/** The chat with its active messages, and the owner id for the access check. */
	async getChat(chatId: string, opts: { includeFeedback?: boolean } = {}): Promise<[UIChat, userId: string] | []> {
		const chat = await this.prisma.chat.findFirst({
			where: { id: chatId, deletedAt: null },
			include: {
				chatMessages: {
					where: { supersededAt: null },
					orderBy: { createdAt: 'asc' },
					include: {
						messageParts: { orderBy: { order: 'asc' } },
						...(opts.includeFeedback && { messageFeedback: true }),
					},
				},
			},
		});
		if (!chat || chat.chatMessages.length === 0) {
			return [];
		}
		const messages = aggregateMessages(chat.chatMessages);
		const versionInfo = await this.buildVersionInfoMap([chatId]);
		return [
			{
				id: chatId,
				projectId: chat.projectId,
				title: chat.title,
				isStarred: chat.isStarred,
				isOnboarding: messages.some((message) => message.source === 'onboarding'),
				createdAt: chat.createdAt.getTime(),
				updatedAt: chat.updatedAt.getTime(),
				messages: messages.map((message) =>
					versionInfo.has(message.id) ? { ...message, versionInfo: versionInfo.get(message.id) } : message,
				),
				forkMetadata: (chat.forkMetadata as ForkMetadata | null) ?? undefined,
			},
			chat.userId,
		];
	}

	async getChatMessages(chatId: string): Promise<UIMessage[]> {
		const messages = await this.prisma.chatMessage.findMany({
			where: { chatId, supersededAt: null },
			orderBy: { createdAt: 'asc' },
			include: { messageParts: { orderBy: { order: 'asc' } } },
		});
		return aggregateMessages(messages);
	}

	async getChatOwnerId(chatId: string): Promise<string | undefined> {
		const chat = await this.prisma.chat.findUnique({ where: { id: chatId }, select: { userId: true } });
		return chat?.userId;
	}

	/** The owner and patient of a chart chat; `patientId` is null for other chats. */
	getChatPatient(chatId: string): Promise<{ userId: string; patientId: string | null } | null> {
		return this.prisma.chat.findFirst({
			where: { id: chatId, deletedAt: null },
			select: { userId: true, patientId: true },
		});
	}

	/** The user's chart chat about the patient (one at most). */
	async getPatientChatId(userId: string, patientId: string): Promise<string | null> {
		const chat = await this.prisma.chat.findFirst({
			where: { userId, patientId, deletedAt: null },
			select: { id: true },
		});
		return chat?.id ?? null;
	}

	async getChatProjectId(chatId: string): Promise<string | undefined> {
		const chat = await this.prisma.chat.findUnique({ where: { id: chatId }, select: { projectId: true } });
		return chat?.projectId;
	}

	/** Chat creation with its first user message (upstream `createChat`). */
	createChat(
		newChat: { userId: string; projectId: string; title: string; surface?: string; patientId?: string },
		newUserMessage: { text: string; source?: UIMessage['source']; citation?: CitationData },
		additionalParts: UIMessagePart[] = [],
	): Promise<[Chat, ChatMessage]> {
		return this.prisma.$transaction(async (tx) => {
			const chat = await tx.chat.create({ data: newChat });
			const messageId = randomUUID();
			const message = await tx.chatMessage.create({
				data: {
					id: messageId,
					chatId: chat.id,
					senderUserId: chat.userId,
					role: 'user',
					source: newUserMessage.source,
					citation: (newUserMessage.citation ?? undefined) as Prisma.InputJsonValue | undefined,
					versionGroupId: messageId,
				},
			});
			const parts: UIMessagePart[] = [{ type: 'text', text: newUserMessage.text }, ...additionalParts];
			await tx.messagePart.createMany({ data: mapUIPartsToDBParts(parts, message.id).map(toPartRow) });
			return [chat, message];
		});
	}

	/** Inserts or replaces a message and its parts (upstream `upsertMessage`). */
	upsertMessage(
		message: Omit<UIMessage, 'id'> & {
			id?: string;
			chatId: string;
			senderUserId?: string;
			stopReason?: StopReason;
			error?: unknown;
			tokenUsage?: TokenUsage;
			llmProvider?: LlmProvider;
			llmModelId?: string;
			versionGroupId?: string;
		},
		options: { updateMetadata?: boolean } = {},
	): Promise<{ messageId: string }> {
		return this.prisma.$transaction(async (tx) => {
			const messageId = message.id ?? randomUUID();
			const values = stripUndefined({
				chatId: message.chatId,
				senderUserId: message.senderUserId,
				role: message.role,
				stopReason: message.stopReason,
				errorMessage: getErrorMessage(message.error) ?? undefined,
				llmProvider: message.llmProvider,
				llmModelId: message.llmModelId,
				source: message.source,
				isForked: message.isForked,
				citation: (message.citation ?? undefined) as Prisma.InputJsonValue | undefined,
				...message.tokenUsage,
			});
			const versionGroupId = message.versionGroupId ?? (message.role === 'user' ? messageId : undefined);
			const existing = await tx.chatMessage.findUnique({ where: { id: messageId }, select: { id: true } });
			if (!existing) {
				await tx.chatMessage.create({
					data: {
						id: messageId,
						...values,
						...(versionGroupId && { versionGroupId }),
					} as Prisma.ChatMessageUncheckedCreateInput,
				});
			} else if (options.updateMetadata !== false) {
				const { chatId: _chatId, ...update } = values;
				await tx.chatMessage.update({
					where: { id: messageId },
					data: update as Prisma.ChatMessageUncheckedUpdateInput,
				});
			}

			await tx.messagePart.deleteMany({ where: { messageId } });
			const parts = mapUIPartsToDBParts(message.parts, messageId);
			if (parts.length > 0) {
				const rows = await remapToolCallIdsCollidingWithOtherMessages(tx, parts, messageId);
				await tx.messagePart.createMany({ data: rows.map(toPartRow) });
			}
			await tx.chat.update({ where: { id: message.chatId }, data: { updatedAt: new Date() } });
			return { messageId };
		});
	}

	/** Marks every message from `fromMessageId` on as superseded (upstream `supersedeMessagesFrom`). */
	async supersedeMessagesFrom(chatId: string, fromMessageId: string): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			const fromMessage = await tx.chatMessage.findFirst({
				where: { id: fromMessageId, chatId },
				select: { createdAt: true },
			});
			if (!fromMessage) {
				return;
			}
			await tx.chatMessage.updateMany({
				where: { chatId, createdAt: { gte: fromMessage.createdAt }, supersededAt: null },
				data: { supersededAt: new Date() },
			});
		});
	}

	/** The version group of an edited message, backfilled when it predates version tracking. */
	async resolveVersionGroupIdForEdit(chatId: string, messageToEditId: string): Promise<string | undefined> {
		const edited = await this.prisma.chatMessage.findFirst({
			where: { id: messageToEditId, chatId },
			select: { id: true, versionGroupId: true },
		});
		if (!edited) {
			return undefined;
		}
		if (edited.versionGroupId) {
			return edited.versionGroupId;
		}
		await this.prisma.chatMessage.update({ where: { id: edited.id }, data: { versionGroupId: edited.id } });
		return edited.id;
	}

	/** Restores a superseded version of a turn as the active branch (upstream `switchMessageVersion`). */
	async switchMessageVersion(chatId: string, targetMessageId: string): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			const target = await tx.chatMessage.findFirst({
				where: { id: targetMessageId, chatId },
				select: { versionGroupId: true, supersededAt: true },
			});
			if (!target?.versionGroupId || target.supersededAt === null) {
				return;
			}
			const group = await tx.chatMessage.findMany({
				where: { chatId, versionGroupId: target.versionGroupId },
				select: { createdAt: true },
			});
			if (group.length === 0) {
				return;
			}
			const forkPoint = new Date(Math.min(...group.map((row) => row.createdAt.getTime())));
			await tx.chatMessage.updateMany({
				where: { chatId, supersededAt: null, createdAt: { gte: forkPoint } },
				data: { supersededAt: new Date() },
			});
			await tx.chatMessage.updateMany({
				where: { chatId, supersededAt: target.supersededAt },
				data: { supersededAt: null },
			});
			await tx.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
		});
	}

	/** Removes the last turn when it has no content (a stopped or failed first answer). */
	deleteLastEmptyTurn(chatId: string): Promise<{ outcome: 'deleted' | 'kept'; chatDeleted: boolean }> {
		return this.prisma.$transaction(async (tx) => {
			const kept = { outcome: 'kept' as const, chatDeleted: false };
			const active = await tx.chatMessage.findMany({
				where: { chatId, supersededAt: null },
				orderBy: { createdAt: 'desc' },
				select: { id: true, role: true, versionGroupId: true },
			});
			const latest = active.at(0);
			if (!latest || latest.role === 'system') {
				return kept;
			}
			const userMessage = latest.role === 'user' ? latest : active.find((message) => message.role === 'user');
			if (!userMessage) {
				return kept;
			}
			if (latest.role === 'assistant') {
				const contentPart = await tx.messagePart.findFirst({
					where: {
						messageId: latest.id,
						type: { notIn: ['step-start', 'reasoning', 'tool-suggest_follow_ups'] },
					},
					select: { id: true },
				});
				if (contentPart) {
					return kept;
				}
			}
			if (userMessage.versionGroupId) {
				const versions = await tx.chatMessage.count({
					where: { chatId, versionGroupId: userMessage.versionGroupId },
				});
				if (versions > 1) {
					return kept;
				}
			}
			const ids = [userMessage.id, ...(latest.role === 'assistant' ? [latest.id] : [])];
			await tx.chatMessage.deleteMany({ where: { chatId, id: { in: ids } } });
			const remaining = await tx.chatMessage.count({ where: { chatId, supersededAt: null } });
			if (remaining > 0) {
				return { outcome: 'deleted', chatDeleted: false };
			}
			await tx.chat.delete({ where: { id: chatId } });
			return { outcome: 'deleted', chatDeleted: true };
		});
	}

	/** `provider/model-id` of the latest active assistant message. */
	async getLastAssistantModel(chatId: string): Promise<string | undefined> {
		const message = await this.prisma.chatMessage.findFirst({
			where: { chatId, role: 'assistant', supersededAt: null },
			orderBy: { createdAt: 'desc' },
			select: { llmProvider: true, llmModelId: true },
		});
		return message?.llmProvider && message.llmModelId ? `${message.llmProvider}/${message.llmModelId}` : undefined;
	}

	async deleteChat(chatId: string): Promise<{ projectId: string }> {
		const chat = await this.prisma.chat.delete({ where: { id: chatId }, select: { projectId: true } });
		return chat;
	}

	async deleteNonStarredChats(userId: string): Promise<{ count: number }> {
		const { count } = await this.prisma.chat.deleteMany({ where: { userId, isStarred: false } });
		return { count };
	}

	async toggleStarred(chatId: string, isStarred: boolean): Promise<void> {
		await this.prisma.chat.update({ where: { id: chatId }, data: { isStarred } });
	}

	async renameChat(chatId: string, title: string): Promise<{ projectId: string }> {
		return this.prisma.chat.update({ where: { id: chatId }, data: { title }, select: { projectId: true } });
	}

	/** Own chats with the sidebar columns (upstream `listOwnChats`). */
	listOwnChats(userId: string): Promise<ChatListRow[]> {
		return this.prisma.$queryRaw<ChatListRow[]>`
			SELECT c.id, c.title, c.is_starred AS "isStarred",
				exists(SELECT 1 FROM chat_message m WHERE m.chat_id = c.id AND m.source = 'onboarding') AS "isOnboarding",
				(extract(epoch FROM c.created_at) * 1000)::float8 AS "createdAt",
				(extract(epoch FROM c.updated_at) * 1000)::float8 AS "updatedAt",
				'own' AS kind, c.project_id AS "projectId", p.name AS "projectName",
				exists(SELECT 1 FROM shared_chat s WHERE s.chat_id = c.id) AS "isSharedByMe",
				u.name AS "ownerName", ${SOURCE_PLATFORM} AS "sourcePlatform"
			FROM chat c
			JOIN project p ON p.id = c.project_id
			JOIN "user" u ON u.id = c.user_id
			WHERE c.user_id = ${userId} AND c.deleted_at IS NULL AND c.surface = 'chat'
				AND NOT exists(SELECT 1 FROM automation_run r WHERE r.chat_id = c.id)
				AND NOT ${IS_QUICK_QUESTION}
			ORDER BY c.updated_at DESC`;
	}

	/** Chats others shared with the user (upstream `listSharedWithMeChats`). */
	listSharedWithMeChats(userId: string): Promise<ChatListRow[]> {
		return this.prisma.$queryRaw<ChatListRow[]>`
			SELECT s.chat_id AS id, c.title, false AS "isStarred", false AS "isOnboarding",
				(extract(epoch FROM c.created_at) * 1000)::float8 AS "createdAt",
				(extract(epoch FROM c.updated_at) * 1000)::float8 AS "updatedAt",
				'shared' AS kind, s.id AS "shareId", c.project_id AS "projectId", p.name AS "projectName",
				false AS "isSharedByMe", u.name AS "ownerName", ${SOURCE_PLATFORM} AS "sourcePlatform"
			FROM shared_chat s
			JOIN chat c ON c.id = s.chat_id
			JOIN project p ON p.id = c.project_id
			JOIN "user" u ON u.id = c.user_id
			LEFT JOIN shared_chat_access a ON a.shared_chat_id = s.id AND a.user_id = ${userId}
			WHERE c.deleted_at IS NULL AND c.user_id <> ${userId}
				AND NOT exists(SELECT 1 FROM automation_run r WHERE r.chat_id = c.id)
				AND NOT exists(SELECT 1 FROM chat_message m WHERE m.chat_id = c.id AND m.source = 'onboarding')
				AND (
					(s.visibility = 'project' AND (
						exists(SELECT 1 FROM project_member pm WHERE pm.project_id = c.project_id AND pm.user_id = ${userId})
						OR exists(SELECT 1 FROM org_member om WHERE om.org_id = p.org_id AND om.user_id = ${userId})))
					OR (s.visibility = 'specific' AND a.user_id IS NOT NULL)
				)
			ORDER BY c.updated_at DESC`;
	}

	/** Title matches first, then message text matches (upstream `searchUserChats`). */
	async searchUserChats(userId: string, query: string, limit = 10): Promise<SearchChatResult[]> {
		const pattern = `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
		const titleMatches = await this.prisma.$queryRaw<
			{ id: string; title: string; createdAt: Date; updatedAt: Date }[]
		>`
			SELECT c.id, c.title, c.created_at AS "createdAt", c.updated_at AS "updatedAt"
			FROM chat c
			WHERE c.user_id = ${userId} AND c.deleted_at IS NULL AND ${EXCLUDED_CHATS} AND c.title ILIKE ${pattern}
			ORDER BY c.updated_at DESC LIMIT ${limit}`;
		const contentMatches = await this.prisma.$queryRaw<
			{ id: string; title: string; createdAt: Date; updatedAt: Date; matchedText: string | null }[]
		>`
			SELECT c.id, c.title, c.created_at AS "createdAt", c.updated_at AS "updatedAt", mp.text AS "matchedText"
			FROM chat c
			JOIN chat_message m ON m.chat_id = c.id
			JOIN message_part mp ON mp.message_id = m.id
			WHERE c.user_id = ${userId} AND c.deleted_at IS NULL AND ${EXCLUDED_CHATS} AND mp.text ILIKE ${pattern}
			ORDER BY c.updated_at DESC LIMIT ${limit * 2}`;

		const results: SearchChatResult[] = titleMatches.map((match) => ({
			id: match.id,
			title: match.title,
			createdAt: match.createdAt.getTime(),
			updatedAt: match.updatedAt.getTime(),
		}));
		const seen = new Set(results.map((result) => result.id));
		for (const match of contentMatches) {
			if (!seen.has(match.id)) {
				seen.add(match.id);
				results.push({
					id: match.id,
					title: match.title,
					createdAt: match.createdAt.getTime(),
					updatedAt: match.updatedAt.getTime(),
					matchedText: match.matchedText ?? undefined,
				});
			}
		}
		return results.slice(0, limit);
	}

	/** Latest non-superseded query part for a query id within a chat, read as SQL. */
	async getExecuteSqlPartByQueryIdInChat(chatId: string, queryId: string): Promise<StoredQueryPart | null> {
		const [row] = await this.prisma.$queryRaw<
			{
				toolCallId: string | null;
				toolName: string | null;
				toolInput: unknown;
				toolOutput: unknown;
				source: string | null;
			}[]
		>`
			SELECT mp.tool_call_id AS "toolCallId", mp.tool_name AS "toolName", mp.tool_input AS "toolInput",
				mp.tool_output AS "toolOutput", m.source
			FROM message_part mp
			JOIN chat_message m ON m.id = mp.message_id
			WHERE m.chat_id = ${chatId} AND m.superseded_at IS NULL
				AND ${PrismaSql(QUERY_RESULT_TOOL_NAME_SQL)}
				AND mp.tool_output->>'id' = ${queryId}
			ORDER BY m.created_at DESC, mp.created_at DESC, mp."order" DESC
			LIMIT 1`;
		if (!row?.toolCallId || !row.toolName || !row.toolInput || !row.toolOutput) {
			return null;
		}
		return {
			toolCallId: row.toolCallId,
			toolName: storedQueryToolName(row.toolName),
			...readQueryPart(row.toolName, row.toolInput, row.toolOutput),
			adminMode: row.source === 'admin',
		};
	}

	/** SQL of the latest active query parts holding these query ids in a chat (upstream `getLatestSqlQueriesByIds`). */
	async getLatestSqlQueriesByIds(chatId: string, queryIds: Set<string>): Promise<Record<string, StoredSqlQuery>> {
		const queriesByChat = await this.getLatestSqlQueriesByChats(new Map([[chatId, queryIds]]));
		return queriesByChat.get(chatId) ?? {};
	}

	/** Load SQL templates for the given query ids from several chats at once (upstream `getLatestSqlQueriesByChats`). */
	async getLatestSqlQueriesByChats(
		queryIdsByChat: Map<string, Set<string>>,
	): Promise<Map<string, Record<string, StoredSqlQuery>>> {
		const allQueryIds = [...new Set([...queryIdsByChat.values()].flatMap((ids) => [...ids]))];
		const parts = await this.loadLatestQueryParts([...queryIdsByChat.keys()], allQueryIds);

		const queriesByChat = new Map<string, Record<string, StoredSqlQuery>>();
		for (const part of parts) {
			const output = part.toolOutput as { id?: string; dialect?: string } | null;
			if (!output?.id || !queryIdsByChat.get(part.chatId)?.has(output.id) || !part.toolName) {
				continue;
			}
			const { sqlQuery, databaseId } = readStoredSql(part.toolName, part.toolInput, part.toolOutput);
			if (sqlQuery) {
				const chatQueries = queriesByChat.get(part.chatId) ?? {};
				chatQueries[output.id] = {
					sqlQuery,
					...(databaseId && { databaseId }),
					...(output.dialect && { dialect: output.dialect }),
					adminMode: part.messageSource === 'admin',
				};
				queriesByChat.set(part.chatId, chatQueries);
			}
		}
		return queriesByChat;
	}

	/** Cached rows of the given query ids in a chat; the latest active part wins (upstream `getLatestSqlQueryDataByIds`). */
	async getLatestSqlQueryDataByIds(
		chatId: string,
		queryIds: Set<string>,
	): Promise<Record<string, { data: unknown[]; columns: string[] }>> {
		const dataByChat = await this.getLatestSqlQueryDataByChats(new Map([[chatId, queryIds]]));
		return dataByChat.get(chatId) ?? {};
	}

	/** Cached rows of the given query ids from several chats at once (upstream `getLatestSqlQueryDataByChats`). */
	async getLatestSqlQueryDataByChats(
		queryIdsByChat: Map<string, Set<string>>,
	): Promise<Map<string, Record<string, { data: unknown[]; columns: string[] }>>> {
		const allQueryIds = [...new Set([...queryIdsByChat.values()].flatMap((ids) => [...ids]))];
		const parts = await this.loadLatestQueryParts([...queryIdsByChat.keys()], allQueryIds);

		const dataByChat = new Map<string, Record<string, { data: unknown[]; columns: string[] }>>();
		for (const part of parts) {
			const output = part.toolOutput as { id?: string; data?: unknown[]; columns?: string[] } | null;
			if (!output?.id || !queryIdsByChat.get(part.chatId)?.has(output.id)) {
				continue;
			}
			const chatData = dataByChat.get(part.chatId) ?? {};
			chatData[output.id] = { data: output.data ?? [], columns: output.columns ?? [] };
			dataByChat.set(part.chatId, chatData);
		}
		return dataByChat;
	}

	/** Columns and rows of a persisted query result (upstream `getQueryResultByQueryId`). */
	async getQueryResultByQueryId(
		chatId: string,
		queryId: string,
	): Promise<{ columns: string[]; data: Record<string, unknown>[] } | null> {
		const part = await this.getExecuteSqlPartByQueryIdInChat(chatId, queryId);
		return part ? extractQueryResult(part.toolOutput) : null;
	}

	/** The stored output of one query part (upstream `getQueryToolOutputInChat`). */
	async getQueryToolOutputInChat(chatId: string, toolCallId: string): Promise<executeSql.Output | null> {
		const part = await this.prisma.messagePart.findFirst({
			where: {
				toolCallId,
				OR: [{ toolName: { in: [...QUERY_TOOL_NAMES] } }, { toolName: { startsWith: QUERY_TOOL_NAME_PREFIX } }],
				chatMessage: { chatId },
			},
			select: { toolOutput: true },
		});
		return (part?.toolOutput as executeSql.Output | null | undefined) ?? null;
	}

	/** The stored output of one tool call in a chat `userId` owns (a report's frozen data); null for anyone else. */
	async getOwnToolOutput(userId: string, chatId: string, toolCallId: string, toolName: string): Promise<unknown> {
		const part = await this.prisma.messagePart.findFirst({
			where: { toolCallId, toolName, chatMessage: { chatId, chat: { userId, deletedAt: null } } },
			select: { toolOutput: true },
		});
		return part?.toolOutput ?? null;
	}

	/** The outputs of these tool calls, in a chat `userId` owns: the results a Wise report embeds. */
	async getOwnToolOutputs(
		userId: string,
		chatId: string,
		toolCallIds: string[],
	): Promise<{ toolCallId: string; toolName: string; output: unknown }[]> {
		if (toolCallIds.length === 0) {
			return [];
		}
		const parts = await this.prisma.messagePart.findMany({
			where: {
				toolCallId: { in: toolCallIds },
				toolState: 'output-available',
				chatMessage: { chatId, chat: { userId, deletedAt: null } },
			},
			select: { toolCallId: true, toolName: true, toolOutput: true },
		});
		return parts.map((part) => ({
			toolCallId: part.toolCallId!,
			toolName: part.toolName!,
			output: part.toolOutput,
		}));
	}

	/** The `report` tool outputs with this report id in a chat `userId` owns, oldest first: its versions. */
	async getOwnReportOutputs(userId: string, chatId: string, reportId: string): Promise<unknown[]> {
		const parts = await this.prisma.messagePart.findMany({
			where: {
				toolName: 'report',
				toolState: 'output-available',
				toolOutput: { path: ['id'], equals: reportId },
				chatMessage: { chatId, chat: { userId, deletedAt: null } },
			},
			orderBy: [{ chatMessage: { createdAt: 'asc' } }, { order: 'asc' }],
			select: { toolOutput: true },
		});
		return parts.map((part) => part.toolOutput);
	}

	async updateExecuteSqlPart(
		toolCallId: string,
		toolInput: executeSql.Input,
		toolOutput: executeSql.Output,
	): Promise<void> {
		const { count } = await this.prisma.messagePart.updateMany({
			where: { toolCallId, toolName: EXECUTE_SQL_TOOL_NAME },
			data: { toolInput: toolInput as Prisma.InputJsonValue, toolOutput: toolOutput as Prisma.InputJsonValue },
		});
		if (count === 0) {
			throw new Error(`Query part ${toolCallId} not found`);
		}
	}

	/** Owner, project and title of a chat, deleted or not (upstream `getChatInfo`). */
	getChatInfo(chatId: string): Promise<{ projectId: string; userId: string; title: string } | null> {
		return this.prisma.chat.findUnique({
			where: { id: chatId },
			select: { projectId: true, userId: true, title: true },
		});
	}

	/** Project of a chat that isn't deleted (upstream `getActiveChatProjectId`). */
	async getActiveChatProjectId(chatId: string): Promise<string | undefined> {
		const chat = await this.prisma.chat.findFirst({
			where: { id: chatId, deletedAt: null },
			select: { projectId: true },
		});
		return chat?.projectId;
	}

	async getForkMetadata(chatId: string): Promise<ForkMetadata | null> {
		const chat = await this.prisma.chat.findUnique({ where: { id: chatId }, select: { forkMetadata: true } });
		return (chat?.forkMetadata as ForkMetadata | null | undefined) ?? null;
	}

	/** The chat's owner when the message belongs to the chat (upstream `getOwnerOfChatAndMessage`). */
	async getOwnerOfChatAndMessage(chatId: string, messageId: string): Promise<string | undefined> {
		const chat = await this.prisma.chat.findFirst({
			where: { id: chatId, chatMessages: { some: { id: messageId } } },
			select: { userId: true },
		});
		return chat?.userId;
	}

	/** The owner, or a recipient of one of the chat's shares (upstream `canUserAccessChat`). */
	async canUserAccessChat(chatId: string, userId: string): Promise<boolean> {
		const owned = await this.prisma.chat.findFirst({ where: { id: chatId, userId }, select: { id: true } });
		if (owned) {
			return true;
		}
		const [shared] = await this.prisma.$queryRaw<{ id: string }[]>`
			SELECT s.id
			FROM shared_chat s
			JOIN chat c ON c.id = s.chat_id
			JOIN project p ON p.id = c.project_id
			LEFT JOIN shared_chat_access a ON a.shared_chat_id = s.id AND a.user_id = ${userId}
			WHERE s.chat_id = ${chatId} AND (
				(s.visibility = 'project' AND (
					exists(SELECT 1 FROM project_member pm WHERE pm.project_id = c.project_id AND pm.user_id = ${userId})
					OR exists(SELECT 1 FROM org_member om WHERE om.org_id = p.org_id AND om.user_id = ${userId})))
				OR (s.visibility = 'specific' AND a.user_id IS NOT NULL)
			)
			LIMIT 1`;
		return Boolean(shared);
	}

	/** A chat seeded with copies of other messages; tool call ids are renewed (upstream `createForkedChat`). */
	createForkedChat(
		newChat: { projectId: string; userId: string; title: string; forkMetadata?: ForkMetadata },
		messages: Array<Omit<UIMessage, 'id'>>,
	): Promise<Chat> {
		return this.prisma.$transaction(async (tx) => {
			const chat = await tx.chat.create({
				data: {
					projectId: newChat.projectId,
					userId: newChat.userId,
					title: newChat.title,
					...(newChat.forkMetadata && {
						forkMetadata: newChat.forkMetadata as unknown as Prisma.InputJsonValue,
					}),
				},
			});
			if (messages.length === 0) {
				return chat;
			}
			const baseTime = Date.now();
			const messageRows = messages.map((message, i) => ({
				id: randomUUID(),
				chatId: chat.id,
				role: message.role,
				isForked: true,
				createdAt: new Date(baseTime + i),
			}));
			await tx.chatMessage.createMany({ data: messageRows });
			const parts = messages.flatMap((message, i) =>
				remapToolCallIds(mapUIPartsToDBParts(message.parts, messageRows[i].id)),
			);
			if (parts.length > 0) {
				await tx.messagePart.createMany({ data: parts.map(toPartRow) });
			}
			return chat;
		});
	}

	/** The user's quick questions about a shared chat or story (upstream `listQuickQuestionChats`). */
	listQuickQuestionChats(
		userId: string,
		sourceId: string,
	): Promise<{ chatId: string; title: string; updatedAt: Date }[]> {
		return this.prisma.$queryRaw`
			SELECT c.id AS "chatId", c.title, c.updated_at AS "updatedAt"
			FROM chat c
			WHERE c.user_id = ${userId} AND c.deleted_at IS NULL AND ${IS_QUICK_QUESTION}
				AND c.fork_metadata->>'id' = ${sourceId}
			ORDER BY c.updated_at DESC`;
	}

	/** Owner of the latest active part holding a query id, across chats (upstream `getExecuteSqlOwnerByQueryId`). */
	async getLatestQueryPartByQueryId(
		queryId: string,
	): Promise<(StoredQueryPart & { projectId: string; userId: string; chatId: string }) | null> {
		const [row] = await this.prisma.$queryRaw<
			{
				projectId: string;
				userId: string;
				chatId: string;
				toolCallId: string | null;
				toolName: string | null;
				toolInput: unknown;
				toolOutput: unknown;
				source: string | null;
			}[]
		>`
			SELECT c.project_id AS "projectId", c.user_id AS "userId", c.id AS "chatId", mp.tool_call_id AS "toolCallId",
				mp.tool_name AS "toolName", mp.tool_input AS "toolInput", mp.tool_output AS "toolOutput", m.source
			FROM message_part mp
			JOIN chat_message m ON m.id = mp.message_id
			JOIN chat c ON c.id = m.chat_id
			WHERE m.superseded_at IS NULL
				AND ${PrismaSql(QUERY_RESULT_TOOL_NAME_SQL)}
				AND mp.tool_output->>'id' = ${queryId}
			ORDER BY m.created_at DESC, mp.created_at DESC, mp."order" DESC
			LIMIT 1`;
		if (!row?.toolCallId || !row.toolName || !row.toolInput || !row.toolOutput) {
			return null;
		}
		return {
			projectId: row.projectId,
			userId: row.userId,
			chatId: row.chatId,
			toolCallId: row.toolCallId,
			toolName: storedQueryToolName(row.toolName),
			...readQueryPart(row.toolName, row.toolInput, row.toolOutput),
			adminMode: row.source === 'admin',
		};
	}

	/** Active query parts of the chats holding one of the query ids, oldest first so the latest one wins. */
	private loadLatestQueryParts(
		chatIds: string[],
		queryIds: string[],
	): Promise<
		{
			chatId: string;
			toolName: string | null;
			toolInput: unknown;
			toolOutput: unknown;
			messageSource: string | null;
		}[]
	> {
		if (chatIds.length === 0 || queryIds.length === 0) {
			return Promise.resolve([]);
		}
		return this.prisma.$queryRaw`
			SELECT m.chat_id AS "chatId", mp.tool_name AS "toolName", mp.tool_input AS "toolInput",
				mp.tool_output AS "toolOutput", m.source AS "messageSource"
			FROM message_part mp
			JOIN chat_message m ON m.id = mp.message_id
			WHERE m.chat_id = ANY(${chatIds}::text[]) AND m.superseded_at IS NULL
				AND ${PrismaSql(QUERY_RESULT_TOOL_NAME_SQL)}
				AND mp.tool_output->>'id' = ANY(${queryIds}::text[])
			ORDER BY m.created_at ASC, mp.created_at ASC, mp."order" ASC`;
	}

	/** Active messages of several chats with feedback and version info, for the `Chat.messages` DataLoader. */
	async getMessagesByChatIds(chatIds: readonly string[]): Promise<Map<string, UIMessage[]>> {
		const [messages, versionInfo] = await Promise.all([
			this.prisma.chatMessage.findMany({
				where: { chatId: { in: [...chatIds] }, supersededAt: null },
				orderBy: { createdAt: 'asc' },
				include: { messageParts: { orderBy: { order: 'asc' } }, messageFeedback: true },
			}),
			this.buildVersionInfoMap(chatIds),
		]);
		const byChat = new Map<string, MessageWithParts[]>();
		for (const message of messages) {
			byChat.set(message.chatId, [...(byChat.get(message.chatId) ?? []), message]);
		}
		return new Map(
			[...byChat].map(([chatId, rows]) => [
				chatId,
				aggregateMessages(rows).map((message) =>
					versionInfo.has(message.id) ? { ...message, versionInfo: versionInfo.get(message.id) } : message,
				),
			]),
		);
	}

	/** A chat that isn't deleted and has messages, without them (upstream `getChat` minus the messages). */
	async getChatSummary(chatId: string): Promise<(Chat & { isOnboarding: boolean }) | null> {
		const chat = await this.prisma.chat.findFirst({
			where: { id: chatId, deletedAt: null, chatMessages: { some: { supersededAt: null } } },
		});
		if (!chat) {
			return null;
		}
		const onboarding = await this.prisma.chatMessage.findFirst({
			where: { chatId, source: 'onboarding', supersededAt: null },
			select: { id: true },
		});
		return { ...chat, isOnboarding: Boolean(onboarding) };
	}

	private async buildVersionInfoMap(chatIds: readonly string[]): Promise<Map<string, MessageVersionInfo>> {
		const rows = await this.prisma.chatMessage.findMany({
			where: { chatId: { in: [...chatIds] }, versionGroupId: { not: null } },
			orderBy: { createdAt: 'asc' },
			select: { id: true, versionGroupId: true, supersededAt: true },
		});
		const groups = new Map<string, typeof rows>();
		for (const row of rows) {
			groups.set(row.versionGroupId!, [...(groups.get(row.versionGroupId!) ?? []), row]);
		}
		const info = new Map<string, MessageVersionInfo>();
		for (const group of groups.values()) {
			if (group.length <= 1) {
				continue;
			}
			const activeIndex = group.findIndex((row) => row.supersededAt === null);
			if (activeIndex === -1) {
				continue;
			}
			info.set(group[activeIndex].id, {
				currentVersion: activeIndex + 1,
				totalVersions: group.length,
				versionIds: group.map((row) => row.id),
			});
		}
		return info;
	}
}

const SOURCE_PLATFORM = PrismaSql(`CASE
	WHEN c.slack_thread_id IS NOT NULL THEN 'Slack'
	WHEN c.teams_thread_id IS NOT NULL THEN 'Teams'
	WHEN c.whatsapp_thread_id IS NOT NULL THEN 'WhatsApp'
	WHEN c.telegram_thread_id IS NOT NULL THEN 'Telegram'
	WHEN c.mattermost_thread_id IS NOT NULL THEN 'Mattermost'
	WHEN c.discord_thread_id IS NOT NULL THEN 'Discord'
	WHEN exists(SELECT 1 FROM chat_message m WHERE m.chat_id = c.id AND m.source = 'mcp') THEN 'MCP'
	WHEN exists(SELECT 1 FROM chat_message m WHERE m.chat_id = c.id AND m.source IN ('contextRecommendations', 'context_recommendation')) THEN 'Context recommendations'
	WHEN exists(SELECT 1 FROM chat_message m WHERE m.chat_id = c.id AND m.source = 'admin') THEN 'Admin'
	ELSE 'Web'
END`);

/** Quick-question forks of a chat or story (upstream `QUICK_QUESTION_FORK_TYPES`) stay out of the lists. */
const IS_QUICK_QUESTION = PrismaSql(
	`coalesce(c.fork_metadata->>'type', '') IN ('chat_selection', 'chat_question', 'story_selection', 'story_question')`,
);

const EXCLUDED_CHATS = PrismaSql(`NOT exists(SELECT 1 FROM automation_run r WHERE r.chat_id = c.id)
	AND NOT exists(SELECT 1 FROM chat_message m WHERE m.chat_id = c.id AND m.source = 'onboarding')
	AND NOT coalesce(c.fork_metadata->>'type', '') IN ('chat_selection', 'chat_question', 'story_selection', 'story_question')`);

/** Loose read of the SQL a stored part ran, tolerant of parts written by older versions (upstream `readStoredSql`). */
function readStoredSql(
	toolName: string,
	toolInput: unknown,
	toolOutput: unknown,
): { sqlQuery?: string; databaseId?: string } {
	if (toolName === EXECUTE_SEMANTIC_QUERY_TOOL_NAME) {
		const output = toolOutput as { compiled_sql?: string; database_id?: string } | null;
		return { sqlQuery: output?.compiled_sql, databaseId: output?.database_id };
	}
	if (isQueryToolAgentName(toolName)) {
		const run = (toolOutput as { query_tool?: { sql_query?: string; database_id?: string } } | null)?.query_tool;
		return { sqlQuery: run?.sql_query, databaseId: run?.database_id };
	}
	const input = toolInput as { sql_query?: string; database_id?: string } | null;
	return { sqlQuery: input?.sql_query, databaseId: input?.database_id };
}

function PrismaSql(text: string) {
	return Prisma.raw(text);
}

function aggregateMessages(messages: MessageWithParts[]): UIMessage[] {
	return messages.flatMap((message) => {
		const parts = message.messageParts
			.map((part) => convertDBPartToUIPart(part))
			.filter((part): part is UIMessagePart => part !== undefined);
		if (parts.length === 0) {
			return [];
		}
		return [
			{
				id: message.id,
				role: message.role as UIMessage['role'],
				parts,
				feedback: message.messageFeedback ?? undefined,
				source: (message.source ?? undefined) as UIMessage['source'],
				isForked: message.isForked ?? undefined,
				citation: (message.citation as CitationData | null) ?? undefined,
				stopReason: (message.stopReason ?? undefined) as StopReason | undefined,
				llmProvider: (message.llmProvider ?? undefined) as LlmProvider | undefined,
				createdAt: message.createdAt.getTime(),
			} as UIMessage,
		];
	});
}

function toPartRow(part: NewMessagePart): Prisma.MessagePartCreateManyInput {
	const json = (value: unknown) =>
		value === undefined || value === null ? undefined : (value as Prisma.InputJsonValue);
	return {
		messageId: part.messageId,
		order: part.order,
		type: part.type,
		text: part.text ?? null,
		reasoningText: part.reasoningText ?? null,
		toolCallId: part.toolCallId ?? null,
		toolName: part.toolName ?? null,
		toolState: part.toolState ?? null,
		toolErrorText: part.toolErrorText ?? null,
		toolInput: json(part.toolInput),
		toolOutput: json(part.toolOutput),
		toolApprovalId: part.toolApprovalId ?? null,
		toolApprovalApproved: part.toolApprovalApproved ?? null,
		toolApprovalReason: part.toolApprovalReason ?? null,
		toolRawInput: json(part.toolRawInput),
		toolProviderMetadata: json(part.toolProviderMetadata),
		providerMetadata: json(part.providerMetadata),
		mediaType: part.mediaType ?? null,
		imageId: part.imageId ?? null,
		storagePath: part.storagePath ?? null,
		filename: part.filename ?? null,
	};
}

/**
 * Provider tool call ids are sometimes only unique within one request: ids that already belong to another
 * message are namespaced with the message id so the unique constraint on `tool_call_id` holds.
 */
async function remapToolCallIdsCollidingWithOtherMessages(
	tx: DbExecutor,
	parts: NewMessagePart[],
	messageId: string,
): Promise<NewMessagePart[]> {
	const toolCallIds = parts.map((part) => part.toolCallId).filter((id): id is string => Boolean(id));
	if (toolCallIds.length === 0) {
		return parts;
	}
	const existing = await tx.messagePart.findMany({
		where: { toolCallId: { in: toolCallIds }, messageId: { not: messageId } },
		select: { toolCallId: true },
	});
	if (existing.length === 0) {
		return parts;
	}
	const colliding = new Set(existing.map((row) => row.toolCallId));
	return parts.map((part) =>
		part.toolCallId && colliding.has(part.toolCallId)
			? { ...part, toolCallId: `${messageId}:${part.toolCallId}` }
			: part,
	);
}

/** Fresh tool call ids for copied parts, keeping the pairs of one message together (upstream `remapToolCallIds`). */
function remapToolCallIds(parts: NewMessagePart[]): NewMessagePart[] {
	const idMap = new Map<string, string>();
	return parts.map((part) => {
		if (!part.toolCallId) {
			return part;
		}
		if (!idMap.has(part.toolCallId)) {
			idMap.set(part.toolCallId, randomUUID());
		}
		return { ...part, toolCallId: idMap.get(part.toolCallId) };
	});
}

function storedQueryToolName(toolName: string): StoredQueryPart['toolName'] {
	if (toolName === EXECUTE_SEMANTIC_QUERY_TOOL_NAME) {
		return EXECUTE_SEMANTIC_QUERY_TOOL_NAME;
	}
	return isQueryToolAgentName(toolName) ? (toolName as `qt_${string}`) : EXECUTE_SQL_TOOL_NAME;
}

function readQueryPart(
	toolName: string,
	toolInput: unknown,
	toolOutput: unknown,
): { toolInput: executeSql.Input; toolOutput: executeSql.Output } {
	if (isQueryToolAgentName(toolName)) {
		const output = savedQueryTool.OutputSchema.parse(toolOutput);
		return {
			toolInput: {
				sql_query: output.query_tool.sql_query,
				database_id: output.query_tool.database_id,
				name: output.query_tool.name,
			},
			toolOutput: output,
		};
	}
	if (toolName === EXECUTE_SEMANTIC_QUERY_TOOL_NAME) {
		const input = executeSemanticQuery.InputSchema.parse(toolInput);
		const output = executeSemanticQuery.OutputSchema.parse(toolOutput);
		return {
			toolInput: { sql_query: output.compiled_sql, database_id: output.database_id, name: input.name },
			toolOutput: output as unknown as executeSql.Output,
		};
	}
	return {
		toolInput: executeSql.InputSchema.parse(toolInput),
		toolOutput: executeSql.OutputSchema.parse(toolOutput),
	};
}

function extractQueryResult(toolOutput: unknown): { columns: string[]; data: Record<string, unknown>[] } | null {
	const output = toolOutput as { columns?: unknown; data?: unknown } | null | undefined;
	if (!output || !Array.isArray(output.columns) || !Array.isArray(output.data)) {
		return null;
	}
	return { columns: output.columns as string[], data: output.data as Record<string, unknown>[] };
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
	return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}
