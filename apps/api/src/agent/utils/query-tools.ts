import { isQueryToolAgentName } from '@loopwise/shared/query-tools';

/** Tool names of upstream `queries/execute-sql.queries.ts`. */
export const EXECUTE_SQL_TOOL_NAME = 'execute_sql';
export const EXECUTE_SEMANTIC_QUERY_TOOL_NAME = 'execute_semantic_query';

/** Tools whose output is a query result addressable by `query_id` (charts, stories, read_query_result). */
export const QUERY_TOOL_NAMES = [EXECUTE_SQL_TOOL_NAME, EXECUTE_SEMANTIC_QUERY_TOOL_NAME] as const;
export type QueryToolName = (typeof QUERY_TOOL_NAMES)[number];

/** Query tools plus saved query tools (`qt_<name>`), whose output is an `execute_sql` result. */
export function isQueryResultToolName(toolName: string): boolean {
	return (QUERY_TOOL_NAMES as readonly string[]).includes(toolName) || isQueryToolAgentName(toolName);
}

/**
 * SQL filter for `message_part.tool_name` matching `isQueryResultToolName`, for raw queries (`mp` alias).
 * `_` is a LIKE wildcard, hence the escape.
 */
export const QUERY_RESULT_TOOL_NAME_SQL = `(mp.tool_name IN ('${QUERY_TOOL_NAMES.join("', '")}') OR mp.tool_name LIKE 'qt\\_%')`;
