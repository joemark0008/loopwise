import { areStructurallyEqual, isToolUIPart } from './ai';
import type { executeSql } from '@quarry/shared/tools';
import type { UIMessage, UIMessagePart } from '@quarry/api/agent/types/chat';

export type SourceQuery = { input?: executeSql.Input; output: executeSql.Output; toolCallId?: string };
const sourceQueryIndex = new WeakMap<UIMessage[], Map<string, SourceQuery>>();

/**
 * Prefer the latest query result in the chat with this id. Loopwise has no SQL tool: any tool whose output has the
 * shape of a query result (`query_<id>`, columns and rows) can feed charts and maps.
 */
export function findLatestExecuteSqlInMessages(messages: UIMessage[], queryId: string): SourceQuery | null {
	let indexed = sourceQueryIndex.get(messages);
	if (indexed) {
		return indexed.get(queryId) ?? null;
	}

	indexed = new Map();
	for (const message of messages) {
		for (const part of message.parts) {
			const sourceQuery = toSourceQuery(part);
			if (sourceQuery) {
				indexed.set(sourceQuery.output.id, sourceQuery);
			}
		}
	}
	sourceQueryIndex.set(messages, indexed);
	return indexed.get(queryId) ?? null;
}

function toSourceQuery(part: UIMessagePart): SourceQuery | null {
	if (!isToolUIPart(part) || part.state !== 'output-available' || !isQueryResult(part.output)) {
		return null;
	}
	return { output: part.output, toolCallId: part.toolCallId };
}

function isQueryResult(output: unknown): output is executeSql.Output {
	if (!output || typeof output !== 'object') {
		return false;
	}
	const { id, columns, data } = output as Partial<executeSql.Output>;
	return typeof id === 'string' && id.startsWith('query_') && Array.isArray(columns) && Array.isArray(data);
}

export function areSourceQueriesEqual(left: SourceQuery | null, right: SourceQuery | null): boolean {
	if (left === right) {
		return true;
	}
	if (!left || !right) {
		return false;
	}
	return (
		left.output.id === right.output.id &&
		left.toolCallId === right.toolCallId &&
		left.output.revision === right.output.revision &&
		areStructurallyEqual(left.input, right.input)
	);
}
