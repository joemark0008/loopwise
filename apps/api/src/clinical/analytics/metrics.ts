import type { getMetric, runAnalyticsSql } from '@loopwise/shared/tools';

export interface MetricParams {
	months: number;
	groupBy?: 'week' | 'month' | 'code' | 'chapter';
}

interface MetricDefinition {
	label: string;
	/** What the number means, in words: shown to the model, the user and (later) the dashboard. */
	definition: string;
	/** The fixed query over the analytics views; `$1` is the period start. */
	sql: (params: MetricParams) => string;
	/** How the result is drawn by default; none for a single number or a list. */
	chart?: (params: MetricParams) => runAnalyticsSql.ResultChart;
}

const PERIOD_START = '$1::timestamptz';
/** Ordered tests still with the lab: requested, paid, specimen collected or in progress, not resulted. */
const OPEN_ORDER = "status IN ('requested', 'paid', 'specimen_collected', 'in_progress')";
/** Result flags from most to least severe. */
const FLAG_RANK =
	"CASE flag WHEN 'critical_high' THEN 6 WHEN 'critical_low' THEN 5 WHEN 'high' THEN 4 WHEN 'low' THEN 3 " +
	"WHEN 'abnormal' THEN 2 WHEN 'normal' THEN 1 ELSE 0 END";

/**
 * Certified metrics (DESIGN.md §10): one definition per headline number, run through the same analytics role as
 * Wise's own SQL, so the chat, the dashboard and the reports can't disagree. Each counts only the patients the user
 * may see.
 */
export const METRIC_DEFINITIONS: Record<getMetric.Metric, MetricDefinition> = {
	panel_size: {
		label: 'Patients in your care',
		definition:
			'Patients you may see (your care relationships, and patients with a visit at a clinic where you work the desk).',
		sql: () => 'SELECT count(*)::int AS patients FROM patients',
	},
	patients_by_age_band: {
		label: 'Patients by age group',
		chart: () => ({ type: 'bar', x: 'age_band', y: ['patients'] }),
		definition: 'Patients in your care by age today: 0-4, 5-17, 18-39, 40-59, 60+.',
		sql: () => 'SELECT age_band, count(*)::int AS patients FROM patients GROUP BY age_band ORDER BY min(age_years)',
	},
	patients_by_sex: {
		label: 'Patients by sex',
		chart: () => ({ type: 'pie', x: 'sex', y: ['patients'] }),
		definition: 'Patients in your care by recorded sex.',
		sql: () => 'SELECT sex, count(*)::int AS patients FROM patients GROUP BY sex ORDER BY patients DESC, sex',
	},
	patients_by_barangay: {
		label: 'Patients by barangay',
		chart: () => ({ type: 'horizontal_bar', x: 'barangay', y: ['patients'] }),
		definition: 'Patients in your care by barangay of residence ("not recorded" when blank).',
		sql: () =>
			"SELECT coalesce(barangay, 'not recorded') AS barangay, count(*)::int AS patients FROM patients " +
			'GROUP BY 1 ORDER BY patients DESC, barangay',
	},
	new_patients: {
		label: 'New patients',
		definition: 'Patients whose first visit falls in the period.',
		sql: () =>
			'SELECT count(*)::int AS new_patients FROM (SELECT patient_id, min(started_at) AS first_visit ' +
			`FROM encounters GROUP BY patient_id) first_visits WHERE first_visit >= ${PERIOD_START}`,
	},
	encounters: {
		label: 'Encounters',
		chart: ({ groupBy }) => ({
			type: 'line',
			x: groupBy === 'week' ? 'week' : 'month',
			y: ['encounters', 'patients'],
		}),
		definition: 'Visits started in the period, per week (Monday) or per month.',
		sql: ({ groupBy }) => {
			const unit = groupBy === 'week' ? 'week' : 'month';
			return (
				`SELECT date_trunc('${unit}', started_at)::date AS ${unit}, count(*)::int AS encounters, ` +
				`count(DISTINCT patient_id)::int AS patients FROM encounters WHERE started_at >= ${PERIOD_START} ` +
				'GROUP BY 1 ORDER BY 1'
			);
		},
	},
	top_diagnoses: {
		label: 'Top diagnoses',
		chart: ({ groupBy }) => ({
			type: 'horizontal_bar',
			x: groupBy === 'chapter' ? 'icd10_chapter' : 'display',
			y: ['diagnoses'],
		}),
		definition:
			'Diagnoses recorded at visits in the period, by ICD-10 code or chapter, most frequent first (top 10).',
		sql: ({ groupBy }) =>
			groupBy === 'chapter'
				? 'SELECT icd10_chapter, count(*)::int AS diagnoses, count(DISTINCT patient_id)::int AS patients ' +
					`FROM diagnoses WHERE diagnosed_at >= ${PERIOD_START} GROUP BY 1 ORDER BY diagnoses DESC, 1 LIMIT 10`
				: 'SELECT icd10_code, display, count(*)::int AS diagnoses, count(DISTINCT patient_id)::int AS patients ' +
					`FROM diagnoses WHERE diagnosed_at >= ${PERIOD_START} GROUP BY 1, 2 ORDER BY diagnoses DESC, 1 LIMIT 10`,
	},
	results_awaiting_review: {
		label: 'Results awaiting review',
		chart: () => ({ type: 'bar', x: 'flag', y: ['results'] }),
		definition: 'Test results not yet reviewed by a clinician, by their most severe analyte flag (any date).',
		sql: () =>
			"SELECT CASE worst WHEN 6 THEN 'critical_high' WHEN 5 THEN 'critical_low' WHEN 4 THEN 'high' " +
			"WHEN 3 THEN 'low' WHEN 2 THEN 'abnormal' WHEN 1 THEN 'normal' ELSE 'none' END AS flag, " +
			`count(*)::int AS results FROM (SELECT order_id, max(${FLAG_RANK}) AS worst FROM results ` +
			'WHERE reviewed_at IS NULL GROUP BY order_id) pending GROUP BY worst ORDER BY worst DESC',
	},
	open_orders: {
		label: 'Open orders by age',
		chart: () => ({ type: 'bar', x: 'age', y: ['orders'] }),
		definition:
			'Ordered tests requested, paid, collected or in progress but not resulted, by days since ordered: 0-2, 3-7, 8-14, over 14.',
		sql: () =>
			"SELECT CASE WHEN age_days <= 2 THEN '0-2 days' WHEN age_days <= 7 THEN '3-7 days' " +
			"WHEN age_days <= 14 THEN '8-14 days' ELSE 'over 14 days' END AS age, count(*)::int AS orders " +
			'FROM (SELECT extract(day FROM now() - created_at)::int AS age_days FROM orders ' +
			`WHERE ${OPEN_ORDER}) open_orders GROUP BY 1 ORDER BY min(age_days)`,
	},
	overdue_follow_ups: {
		label: 'Overdue follow-ups',
		definition:
			'Patients whose latest visit asked for a follow-up date that has passed, with no visit since (most overdue first).',
		sql: () =>
			'SELECT p.patient_id, p.name, latest.follow_up_on, (current_date - latest.follow_up_on) AS days_overdue ' +
			'FROM (SELECT DISTINCT ON (patient_id) patient_id, follow_up_on FROM encounters ' +
			'ORDER BY patient_id, started_at DESC) latest JOIN patients p USING (patient_id) ' +
			'WHERE latest.follow_up_on < current_date ORDER BY days_overdue DESC LIMIT 100',
	},
	rx_issued: {
		label: 'Prescriptions issued',
		chart: () => ({ type: 'horizontal_bar', x: 'generic_name', y: ['prescriptions'] }),
		definition: 'Issued prescriptions in the period, by medicine (generic name), most frequent first.',
		sql: () =>
			'SELECT generic_name, count(DISTINCT prescription_id)::int AS prescriptions, ' +
			'count(DISTINCT patient_id)::int AS patients FROM prescription_items ' +
			`WHERE prescription_status = 'issued' AND issued_at >= ${PERIOD_START} GROUP BY 1 ORDER BY 2 DESC, 1`,
	},
	billing_totals: {
		label: 'Billing totals',
		chart: () => ({ type: 'bar', x: 'status', y: ['net'] }),
		definition:
			'Invoices dated in the period by status (voided excluded), in PHP: gross, senior citizen / PWD and other discounts, amount due (net), paid (PhilHealth package payments included) and balance.',
		sql: () =>
			'SELECT status, count(*)::int AS invoices, round(sum(gross_amount), 2) AS gross, ' +
			'round(sum(sc_pwd_discount + other_discount), 2) AS discounts, round(sum(net_amount), 2) AS net, ' +
			'round(sum(amount_paid), 2) AS paid, round(sum(balance), 2) AS balance FROM invoices ' +
			`WHERE invoice_date >= ${PERIOD_START} GROUP BY 1 ORDER BY 1`,
	},
	screening_funnel: {
		label: 'Screening-to-care funnel',
		definition:
			'Tests ordered in the period, then how many were resulted, reviewed by a clinician, and actioned (the patient had a visit after the result).',
		chart: () => ({ type: 'funnel', x: 'step', y: ['orders'] }),
		sql: () =>
			`SELECT 'Ordered' AS step, count(*)::int AS orders FROM orders WHERE created_at >= ${PERIOD_START} ` +
			"UNION ALL SELECT 'Resulted', count(DISTINCT r.order_id)::int FROM results r JOIN orders o USING (order_id) " +
			`WHERE o.created_at >= ${PERIOD_START} ` +
			"UNION ALL SELECT 'Reviewed', count(DISTINCT r.order_id)::int FROM results r JOIN orders o USING (order_id) " +
			`WHERE o.created_at >= ${PERIOD_START} AND r.reviewed_at IS NOT NULL ` +
			"UNION ALL SELECT 'Actioned', count(DISTINCT r.order_id)::int FROM results r JOIN orders o USING (order_id) " +
			`WHERE o.created_at >= ${PERIOD_START} AND EXISTS (SELECT 1 FROM encounters e ` +
			'WHERE e.patient_id = r.patient_id AND e.started_at > r.resulted_at)',
	},
};

/** The first day of a period of `months` back from `today`. */
export function periodStart(months: number, today = new Date()): string {
	const start = new Date(today);
	start.setUTCMonth(start.getUTCMonth() - months);
	return start.toISOString();
}
