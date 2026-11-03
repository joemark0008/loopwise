import type { CitationPayload } from '@loopwise/shared';
import { Injectable, Logger } from '@nestjs/common';
import nodeSqlParser from 'node-sql-parser';

import { HandlerError } from '../common/errors/handler-error.js';
import { ChatRepository } from './chat.repository.js';
import { buildColumnLineage, extractTables } from './citation.js';

/** CommonJS package: the named export only exists on the default import under Node's ESM loader. */
const parser = new nodeSqlParser.Parser();

/**
 * Port of upstream `trpc/citation.routes.ts` and `queries/citation.queries.ts`: the SQL and column lineage behind
 * a cited value. Lineage uses `node-sql-parser`, as upstream (the SQL engine's guards use `pgsql-parser`).
 */
@Injectable()
export class CitationService {
	private readonly logger = new Logger(CitationService.name);
	private readonly cache: Record<string, CitationPayload> = {};

	constructor(private readonly chats: ChatRepository) {}

	async getCitation(projectId: string, queryId: string, column: string): Promise<CitationPayload> {
		const part = await this.chats.getLatestQueryPartByQueryId(queryId);
		if (part?.projectId !== projectId) {
			throw new HandlerError('FORBIDDEN', 'Query does not belong to this project.');
		}

		const cacheKey = `${queryId}:${column}`;
		if (this.cache[cacheKey]) {
			return this.cache[cacheKey];
		}
		const payload = this.buildCitation(part.toolInput as { sql_query: string; database_id?: string }, column);
		this.cache[cacheKey] = payload;
		return payload;
	}

	private buildCitation(input: { sql_query: string; database_id?: string }, column: string): CitationPayload {
		const sqlQuery = input.sql_query;
		try {
			const { tableList, ast } = parser.parse(sqlQuery);
			return {
				sql_query: sqlQuery,
				database_id: input.database_id ?? '',
				tables: extractTables(tableList),
				column_lineage: buildColumnLineage(column, ast, parser),
			};
		} catch (error) {
			this.logger.warn(`Failed to parse SQL query: ${error instanceof Error ? error.message : String(error)}`);
			return {
				sql_query: sqlQuery,
				database_id: input.database_id ?? '',
				tables: [],
				column_lineage: { name: column, source_name: '', sources: [] },
			};
		}
	}
}
