import { chartProblem, retype } from '@loopwise/shared/analytics-chart';
import { describeAnalytics, getMetric, runAnalyticsSql } from '@loopwise/shared/tools';
import { Injectable, Logger } from '@nestjs/common';

import { HandlerError } from '../../common/errors/handler-error.js';
import { AccessService } from '../../common/guards/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AnalyticsRepository, type AnalyticsRows } from './analytics.repository.js';
import { METRIC_DEFINITIONS, type MetricParams, periodStart } from './metrics.js';
import { SqlRejected, validateAnalyticsSql } from './sql-validator.js';

/** Where a query came from, for the audit row (`audit_log.origin`). */
export interface AnalyticsOrigin {
	chatId: string;
	toolCallId: string;
	tool: string;
}

/** Patient ids listed in an audit row; past this, only their number. */
const MAX_AUDITED_PATIENT_IDS = 50;
/** Viewer-only users see aggregates with counts under this shown as "<5" (small-cell suppression). */
const SMALL_CELL = 5;
const DEFAULT_MONTHS = 12;

/**
 * Wise analytics over the user's own data (DESIGN.md §7.2, §8.2): the SQL is checked by the parser-based validator,
 * then run by `AnalyticsRepository` on the analyst role, bound to the user, read-only, time- and row-capped. Every
 * query, refused or run, writes an audit row with its SQL, row count and the patients it returned.
 */
@Injectable()
export class AnalyticsService {
	private readonly logger = new Logger(AnalyticsService.name);

	constructor(
		private readonly analytics: AnalyticsRepository,
		private readonly access: AccessService,
		private readonly audit: AuditService,
	) {}

	async describe(): Promise<Omit<describeAnalytics.Output, '_version'>> {
		const columns = await this.analytics.describeViews();
		const views = new Map<string, describeAnalytics.Output['views'][number]>();
		for (const column of columns) {
			const view = views.get(column.view) ?? {
				name: column.view,
				description: column.viewDescription ?? '',
				columns: [],
			};
			view.columns.push({ name: column.column, type: column.type, description: column.description ?? '' });
			views.set(column.view, view);
		}
		return {
			views: [...views.values()],
			metrics: Object.entries(METRIC_DEFINITIONS).map(([name, metric]) => ({
				name,
				label: metric.label,
				definition: metric.definition,
			})),
		};
	}

	async run(
		userId: string,
		input: { sql: string; purpose: string; chart?: runAnalyticsSql.ResultChart },
		origin: AnalyticsOrigin,
	): Promise<Omit<runAnalyticsSql.Output, '_version'>> {
		let sql: string;
		try {
			sql = await validateAnalyticsSql(input.sql);
		} catch (error) {
			if (error instanceof SqlRejected) {
				await this.recordAudit(
					userId,
					'analytics.query.rejected',
					origin,
					{ sql: input.sql, purpose: input.purpose },
					null,
					error.message,
				);
				throw new HandlerError('BAD_REQUEST', `Query refused: ${error.message}`);
			}
			throw error;
		}
		const result = await this.execute(userId, sql, [], runAnalyticsSql.MAX_ROWS, origin, input.purpose);
		const truncated = result.rows.length > runAnalyticsSql.MAX_ROWS;
		const rows = truncated ? result.rows.slice(0, runAnalyticsSql.MAX_ROWS) : result.rows;
		const suppressed = await this.suppress(userId, { columns: result.columns, rows });
		return {
			purpose: input.purpose,
			sql,
			columns: result.columns,
			rows: suppressed.rows,
			rowCount: rows.length,
			truncated,
			suppressed: suppressed.applied,
			chart: input.chart ? withThresholds(checkChart(input.chart, result.columns, suppressed.rows)) : null,
		};
	}

	async metric(
		userId: string,
		input: {
			metric: getMetric.Metric;
			months?: number;
			groupBy?: MetricParams['groupBy'];
			chart?: getMetric.Input['chart'];
		},
		origin: AnalyticsOrigin,
	): Promise<Omit<getMetric.Output, '_version'>> {
		const definition = METRIC_DEFINITIONS[input.metric];
		const params: MetricParams = { months: input.months ?? DEFAULT_MONTHS, groupBy: input.groupBy };
		const sql = await validateAnalyticsSql(definition.sql(params), { allowParams: true });
		const values = sql.includes('$1') ? [periodStart(params.months)] : [];
		const result = await this.execute(userId, sql, values, runAnalyticsSql.MAX_ROWS, origin, definition.label);
		const suppressed = await this.suppress(userId, result);
		return {
			metric: input.metric,
			label: definition.label,
			definition: definition.definition,
			months: values.length > 0 ? params.months : null,
			sql,
			columns: result.columns,
			rows: suppressed.rows,
			suppressed: suppressed.applied,
			chart: withThresholds(
				metricChart(definition.chart?.(params) ?? null, input.chart, result.columns, suppressed.rows),
			),
		};
	}

	private async execute(
		userId: string,
		sql: string,
		params: unknown[],
		maxRows: number,
		origin: AnalyticsOrigin,
		purpose: string,
	): Promise<AnalyticsRows> {
		let result: AnalyticsRows;
		try {
			result = await this.analytics.runAsUser(userId, sql, params, maxRows);
		} catch (error) {
			const message = databaseMessage(error);
			this.logger.warn(`Analytics query failed: ${message}`);
			await this.recordAudit(userId, 'analytics.query.failed', origin, { sql, purpose }, null, message);
			throw new HandlerError('BAD_REQUEST', `Query failed: ${message}`);
		}
		await this.recordAudit(userId, 'analytics.query', origin, { sql, purpose }, result, null);
		return result;
	}

	/**
	 * One audit row per query, run or refused (RA 10173: who read which patient data): its SQL, the row count and the
	 * patients it returned. Written in a transaction of its own, since the query ran on the analyst's connection.
	 */
	private async recordAudit(
		userId: string,
		event: 'analytics.query' | 'analytics.query.rejected' | 'analytics.query.failed',
		origin: AnalyticsOrigin,
		query: { sql: string; purpose: string },
		result: AnalyticsRows | null,
		error: string | null,
	): Promise<void> {
		const patientColumn = result?.columns.indexOf('patient_id') ?? -1;
		const patientIds =
			result && patientColumn >= 0
				? [
						...new Set(
							result.rows
								.map((row) => row[patientColumn])
								.filter((id): id is string => typeof id === 'string'),
						),
					]
				: [];
		await this.audit.recordOutsideTransaction({
			action: 'VIEW',
			event,
			entityType: 'AnalyticsQuery',
			entityId: origin.toolCallId,
			userId,
			reason: error ?? query.purpose,
			origin: {
				source: 'wise',
				chatId: origin.chatId,
				toolCallId: origin.toolCallId,
				tool: origin.tool,
				sql: query.sql,
				...(result && {
					rowCount: result.rows.length,
					scope: patientColumn >= 0 ? 'patients' : 'aggregate',
					...(patientIds.length <= MAX_AUDITED_PATIENT_IDS
						? { patientIds }
						: { patientCount: patientIds.length }),
				}),
				...(error && { error }),
			},
		});
	}

	/**
	 * Counts 1–4 become "<5" in aggregate results of users whose only role, at every clinic, is VIEWER (read-only
	 * staff, not clinicians): small cells could identify a patient (RA 10173).
	 */
	private async suppress(
		userId: string,
		result: AnalyticsRows,
	): Promise<{ rows: AnalyticsRows['rows']; applied: boolean }> {
		if (result.columns.includes('patient_id') || !(await this.isViewerOnly(userId))) {
			return { rows: result.rows, applied: false };
		}
		let applied = false;
		const rows = result.rows.map((row) =>
			row.map((cell) => {
				if (typeof cell === 'number' && Number.isInteger(cell) && cell > 0 && cell < SMALL_CELL) {
					applied = true;
					return `<${SMALL_CELL}`;
				}
				return cell;
			}),
		);
		return { rows, applied };
	}

	private async isViewerOnly(userId: string): Promise<boolean> {
		const clinics = await this.access.listUserClinics(userId);
		return clinics.length > 0 && clinics.every((grant) => grant.userRole === 'viewer');
	}
}

/** The database's reason, without internals: the model reads it to fix the query. */
function databaseMessage(error: unknown): string {
	const { message = 'unknown error', code } = error as { message?: string; code?: string };
	if (code === '57014') {
		return 'the query took longer than 5 seconds; narrow it down.';
	}
	return message;
}

/** A metric's chart: its default, as the type the user asked for, or none. */
function metricChart(
	chart: runAnalyticsSql.ResultChart | null,
	requested: getMetric.Input['chart'],
	columns: string[],
	rows: runAnalyticsSql.Cell[][],
): runAnalyticsSql.ResultChart | null {
	if (!chart || requested === 'none' || rows.length === 0) {
		return null;
	}
	return checkChart(requested ? retype(chart, requested) : chart, columns, rows);
}

/**
 * A chart drawn from the result's own columns (`@loopwise/shared/analytics-chart`): every column it names must be in the
 * result and the value columns numeric, so a chart can't show a number the query didn't return. Refused with a
 * message the model can act on. Model-supplied references are dropped: the server resolves thresholds itself.
 */
export function checkChart(
	chart: runAnalyticsSql.ResultChartInput,
	columns: string[],
	rows: runAnalyticsSql.Cell[][],
): runAnalyticsSql.ResultChart {
	const problem = chartProblem(chart, columns, rows);
	if (problem) {
		throw new HandlerError('BAD_REQUEST', problem);
	}
	const { references: _ignored, ...rest } = chart as runAnalyticsSql.ResultChart;
	return rest;
}

/**
 * The fixed clinical cut-offs a chart may draw, by threshold key: HbA1c 5.7 / 6.5 % (prediabetes / diabetes range),
 * fasting glucose 100 / 126 mg/dL (impaired / diabetes range), blood pressure 140/90 mmHg (hypertension).
 */
const THRESHOLDS: Record<runAnalyticsSql.ThresholdKey, runAnalyticsSql.ChartReference[]> = {
	'4548-4': [
		{ label: 'HbA1c 5.7 %', axis: 'y', value: 5.7, tone: 'actionable' },
		{ label: 'Prediabetes range', axis: 'y', from: 5.7, to: 6.5, tone: 'actionable' },
		{ label: 'HbA1c 6.5 %', axis: 'y', value: 6.5, tone: 'actionable' },
		{ label: 'Diabetes range', axis: 'y', from: 6.5, tone: 'actionable' },
	],
	'1558-6': [
		{ label: 'Fasting glucose 100 mg/dL', axis: 'y', value: 100, tone: 'actionable' },
		{ label: 'Impaired fasting glucose', axis: 'y', from: 100, to: 126, tone: 'actionable' },
		{ label: 'Fasting glucose 126 mg/dL', axis: 'y', value: 126, tone: 'actionable' },
		{ label: 'Diabetes range', axis: 'y', from: 126, tone: 'actionable' },
	],
	bp: [
		{ label: 'Systolic 140', axis: 'y', value: 140, tone: 'actionable' },
		{ label: 'Diastolic 90', axis: 'y', value: 90, tone: 'actionable' },
	],
};

/** The reference lines and bands of threshold keys. Unknown keys draw nothing. */
export function thresholdReferences(keys: readonly string[]): runAnalyticsSql.ChartReference[] {
	return keys.flatMap((key) => THRESHOLDS[key as runAnalyticsSql.ThresholdKey] ?? []);
}

/** The chart with its threshold keys resolved to reference lines and bands. */
function withThresholds(chart: runAnalyticsSql.ResultChart | null): runAnalyticsSql.ResultChart | null {
	if (!chart?.thresholds?.length) {
		return chart;
	}
	return { ...chart, references: thresholdReferences(chart.thresholds) };
}
