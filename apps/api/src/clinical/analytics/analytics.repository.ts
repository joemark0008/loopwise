import crypto from 'node:crypto';

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';

import { ConfigService } from '../../config/config.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/** How long one analytics query may run. */
export const STATEMENT_TIMEOUT_MS = 5000;

export interface AnalyticsRows {
	columns: string[];
	rows: (string | number | boolean | null)[][];
}

export interface ViewColumn {
	view: string;
	viewDescription: string | null;
	column: string;
	type: string;
	description: string | null;
}

/** Postgres types `pg` returns as strings that are safe numbers here: int8 (counts) and numeric. */
const NUMERIC_TYPES = new Set([20, 1700]);
const DATE_TYPE = 1082;

/**
 * Wise analytics (migration 0015). Queries run on their own pool, logged in as `loopwise_analyst`: a role that can
 * read the `analytics` views and nothing else, bound to the user per transaction by a one-time token the system
 * issues here. The system side (tokens, audit, schema description) uses Prisma.
 */
@Injectable()
export class AnalyticsRepository implements OnModuleDestroy {
	private pool: pg.Pool | null = null;

	constructor(
		private readonly prisma: PrismaService,
		private readonly config: ConfigService,
	) {}

	async onModuleDestroy(): Promise<void> {
		await this.pool?.end();
	}

	/** Runs `sql` read-only as `userId`, capped at `maxRows + 1` rows so the caller knows when it truncated. */
	async runAsUser(userId: string, sql: string, params: unknown[], maxRows: number): Promise<AnalyticsRows> {
		const token = crypto.randomBytes(32).toString('hex');
		await this.issueGrant(token, userId);
		try {
			return await this.runWithToken(
				token,
				`SELECT * FROM (${sql}) AS analytics_query LIMIT ${maxRows + 1}`,
				params,
			);
		} finally {
			// Single use: a rolled-back run would otherwise leave the grant valid until it expires.
			await this.revokeGrant(token);
		}
	}

	/** The analyst side of a run. Exposed for the security tests, which must reach Postgres past the validator. */
	async runWithToken(token: string | null, sql: string, params: unknown[] = []): Promise<AnalyticsRows> {
		const client = await this.analystPool().connect();
		try {
			await client.query('BEGIN');
			if (token) {
				await client.query('SELECT analytics.bind($1)', [token]);
			}
			// Read-only from here on: Postgres refuses to switch a transaction back to read-write after a query.
			await client.query('SET LOCAL transaction_read_only = on');
			await client.query(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
			// Extended protocol even without parameters: it carries exactly one statement, whatever the text holds.
			const result = await client.query<unknown[]>({
				text: sql,
				values: params,
				rowMode: 'array',
				queryMode: 'extended',
			} as pg.QueryArrayConfig);
			await client.query('COMMIT');
			return {
				columns: result.fields.map((field) => field.name),
				rows: (result.rows as unknown[][]).map((row) =>
					row.map((value, index) => toCell(value, result.fields[index].dataTypeID)),
				),
			};
		} catch (error) {
			await client.query('ROLLBACK').catch(() => {});
			throw error;
		} finally {
			client.release();
		}
	}

	async issueGrant(token: string, userId: string, ttlSeconds = 30): Promise<void> {
		await this.prisma.$executeRaw`
			INSERT INTO app_private.analytics_grant (token_hash, user_id, expires_at)
			VALUES (${hash(token)}, ${userId}, now() + make_interval(secs => ${ttlSeconds}))`;
	}

	async revokeGrant(token: string): Promise<void> {
		await this.prisma.$executeRaw`DELETE FROM app_private.analytics_grant WHERE token_hash = ${hash(token)}`;
	}

	/** The analytics views and their documented columns, in order. */
	describeViews(): Promise<ViewColumn[]> {
		return this.prisma.$queryRaw<ViewColumn[]>`
			SELECT c.relname AS view, obj_description(c.oid, 'pg_class') AS "viewDescription",
				a.attname AS column, format_type(a.atttypid, a.atttypmod) AS type,
				col_description(c.oid, a.attnum) AS description
			FROM pg_class c
			JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'analytics'
			JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
			WHERE c.relkind = 'v'
			ORDER BY c.relname, a.attnum`;
	}

	writeAudit(entry: {
		userId: string;
		action: string;
		patientId?: string | null;
		resourceId?: string | null;
		reason?: string | null;
		origin: Prisma.InputJsonValue;
	}): Promise<unknown> {
		return this.prisma.auditLog.create({
			data: {
				userId: entry.userId,
				action: entry.action,
				resource: 'analytics',
				resourceId: entry.resourceId ?? null,
				patientId: entry.patientId ?? null,
				reason: entry.reason ?? null,
				origin: entry.origin,
			},
		});
	}

	private analystPool(): pg.Pool {
		this.pool ??= new pg.Pool({
			connectionString: this.config.env.ANALYTICS_DATABASE_URL ?? analystUrl(this.config.env.DATABASE_URL),
			ssl: this.config.env.DB_SSL ? { rejectUnauthorized: false } : undefined,
			max: 5,
			application_name: 'loopwise-analytics',
			// Dates stay YYYY-MM-DD rather than becoming midnight in the server's time zone.
			types: {
				getTypeParser: ((oid: number, format?: 'text' | 'binary') =>
					oid === DATE_TYPE
						? (value: string) => value
						: pg.types.getTypeParser(oid, format)) as typeof pg.types.getTypeParser,
			},
		});
		return this.pool;
	}
}

const hash = (token: string) => crypto.createHash('sha256').update(token, 'utf8').digest('hex');

/** DATABASE_URL with the development analyst credentials. */
export function analystUrl(databaseUrl: string): string {
	const url = new URL(databaseUrl);
	url.username = 'loopwise_analyst';
	url.password = 'loopwise_analyst';
	return url.toString();
}

function toCell(value: unknown, typeId: number): string | number | boolean | null {
	if (value === null || value === undefined) {
		return null;
	}
	if (value instanceof Date) {
		return value.toISOString();
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return value;
	}
	if (NUMERIC_TYPES.has(typeId) && typeof value === 'string' && Number.isFinite(Number(value))) {
		return Number(value);
	}
	return typeof value === 'string' ? value : JSON.stringify(value);
}
