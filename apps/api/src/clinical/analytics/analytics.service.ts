import { chartProblem, retype } from '@loopwise/shared/analytics-chart';
import type { PathwayDefinition } from '@loopwise/shared/pathway-rules';
import { describeAnalytics, getMetric, runAnalyticsSql } from '@loopwise/shared/tools';
import { Injectable } from '@nestjs/common';

import { HandlerError } from '../../common/errors/handler-error.js';
import { OrganizationRepository } from '../../organizations/organization.repository.js';
import { PathwaysService } from '../pathways/pathways.service.js';
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
/** Program users see aggregates with counts under this shown as "<5" (small-cell suppression). */
const SMALL_CELL = 5;
const DEFAULT_MONTHS = 12;

/**
 * Wise analytics over the user's own data (DESIGN.md §7.2, §8.2): the SQL is checked by the parser-based validator,
 * then run by `AnalyticsRepository` on the analyst role, bound to the user, read-only, time- and row-capped. Every
 * query, refused or run, writes an audit row with its SQL, row count and the patients it returned.
 */
@Injectable()
export class AnalyticsService {
	constructor(
		private readonly analytics: AnalyticsRepository,
		private readonly organizations: OrganizationRepository,
		private readonly pathways: PathwaysService,
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
				await this.audit(
					userId,
					'analytics.rejected',
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
			chart: input.chart
				? await this.withThresholds(checkChart(input.chart, result.columns, suppressed.rows))
				: null,
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
			chart: await this.withThresholds(
				metricChart(definition.chart?.(params) ?? null, input.chart, result.columns, suppressed.rows),
			),
		};
	}

	/** The chart with its threshold keys resolved to reference lines and bands. */
	private async withThresholds(
		chart: runAnalyticsSql.ResultChart | null,
	): Promise<runAnalyticsSql.ResultChart | null> {
		if (!chart?.thresholds?.length) {
			return chart;
		}
		return { ...chart, references: thresholdReferences(chart.thresholds, await this.pathways.active()) };
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
			await this.audit(userId, 'analytics.failed', origin, { sql, purpose }, null, message);
			throw new HandlerError('BAD_REQUEST', `Query failed: ${message}`);
		}
		await this.audit(userId, 'analytics.query', origin, { sql, purpose }, result, null);
		return result;
	}

	private async audit(
		userId: string,
		action: string,
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
		await this.analytics.writeAudit({
			userId,
			action,
			resourceId: origin.toolCallId,
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

	/** Counts 1–4 become "<5" in aggregate results of users who only work at program offices (not clinicians). */
	private async suppress(
		userId: string,
		result: AnalyticsRows,
	): Promise<{ rows: AnalyticsRows['rows']; applied: boolean }> {
		if (result.columns.includes('patient_id') || !(await this.isProgramOnly(userId))) {
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

	private async isProgramOnly(userId: string): Promise<boolean> {
		const facilities = await this.organizations.getUserFacilities(userId);
		return facilities.length > 0 && facilities.every((facility) => facility.type === 'program');
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

/** Fixed vital-sign cut-offs a chart may draw ("bp"), the ones `chart_patient_trend` uses. */
const BP_REFERENCES: runAnalyticsSql.ChartReference[] = [
	{ label: 'Systolic 140', axis: 'y', value: 140, tone: 'actionable' },
	{ label: 'Diastolic 90', axis: 'y', value: 90, tone: 'actionable' },
];

/**
 * The reference lines and bands of threshold keys, from the active pathways' numeric bands (a line where each band
 * starts, a band over each actionable or critical range) or the fixed BP cut-offs. Unknown keys draw nothing.
 */
export function thresholdReferences(keys: string[], pathways: PathwayDefinition[]): runAnalyticsSql.ChartReference[] {
	const references: runAnalyticsSql.ChartReference[] = [];
	for (const key of keys) {
		if (key === 'bp') {
			references.push(...BP_REFERENCES);
			continue;
		}
		for (const trigger of pathways.flatMap((pathway) => pathway.rules.triggers)) {
			if (trigger.type !== 'numeric' || trigger.code !== key) {
				continue;
			}
			for (const band of trigger.bands) {
				if (band.min !== undefined) {
					references.push({
						label: `${trigger.display} ${band.min} ${trigger.unit} (${band.classification})`,
						axis: 'y',
						value: band.min,
						tone: band.classification,
					});
				}
				if (band.classification !== 'normal' && (band.min !== undefined || band.below !== undefined)) {
					references.push({
						label: band.reason,
						axis: 'y',
						from: band.min,
						to: band.below,
						tone: band.classification,
					});
				}
			}
		}
	}
	return references;
}
