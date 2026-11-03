import type { QueryResult, ToolContext } from '../types/tools.js';

/**
 * Port of upstream `services/query-result.service.ts`: a query result by id from the current run's in-memory
 * cache, falling back to the chat's persisted messages for queries from earlier turns (cached back).
 */
export async function getQueryResult(context: ToolContext, queryId: string): Promise<QueryResult | null> {
	const cached = context.queryResults.get(queryId);
	if (cached) {
		return cached;
	}

	const fromDb = await context.services.getQueryResultByQueryId(context.chatId, queryId);
	if (!fromDb) {
		return null;
	}

	context.queryResults.set(queryId, fromDb);
	return fromDb;
}
