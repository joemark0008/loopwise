import { getMetric } from '@quarry/shared/tools';
import { describe, expect, it } from 'vitest';

import { METRIC_DEFINITIONS } from './metrics.js';
import { validateAnalyticsSql } from './sql-validator.js';

describe('analytics SQL validator', () => {
	it.each([
		'SELECT count(*) FROM patients',
		'select age_band, count(*) as n from analytics.patients group by 1 order by 1;',
		`WITH visits AS (SELECT patient_id, count(*) AS n FROM encounters GROUP BY 1)
			SELECT p.name, v.n, rank() OVER (ORDER BY v.n DESC) FROM visits v JOIN patients p USING (patient_id)`,
		"SELECT date_trunc('month', started_at)::date, count(*) FROM encounters WHERE started_at >= now() - interval '6 months' GROUP BY 1",
		"SELECT icd10_chapter, count(DISTINCT patient_id) FILTER (WHERE certainty = 'confirmed') FROM diagnoses GROUP BY 1",
		'SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY systolic_mmhg) FROM vitals',
		"SELECT CASE WHEN bmi >= 30 THEN 1 ELSE 0 END, coalesce(barangay, nullif(name, '')) FROM vitals, patients",
		'SELECT extract(year FROM age(current_date, resulted_at)) FROM results',
		"SELECT d::date FROM generate_series(now() - interval '1 year', now(), interval '1 month') d",
		'SELECT 1 UNION ALL SELECT 2',
	])('accepts %s', async (sql) => {
		await expect(validateAnalyticsSql(sql)).resolves.toBeTypeOf('string');
	});

	it.each([
		['DELETE FROM patients', /Only SELECT/],
		['SELECT 1; SELECT 2', /exactly one/],
		['WITH d AS (DELETE FROM patients RETURNING 1) SELECT * FROM d', /Only SELECT/],
		['SELECT * INTO x FROM patients', /SELECT INTO/],
		['SELECT * FROM patients FOR UPDATE', /FOR UPDATE/],
		['SELECT * FROM public.patient', /Only the analytics views/],
		['SELECT * FROM patient', /Unknown view "patient"/],
		['SELECT * FROM pg_catalog.pg_class', /Only the analytics views/],
		['SELECT * FROM pg_stat_activity', /Unknown view/],
		["SELECT set_config('app.user_id', 'x', true)", /set_config\(\) is not allowed/],
		["SELECT current_setting('app.user_id')", /current_setting\(\) is not allowed/],
		['SELECT pg_sleep(1)', /pg_sleep/],
		["SELECT pg_read_file('/etc/passwd')", /pg_read_file/],
		["SELECT dblink('x', 'y')", /dblink/],
		["SELECT 'patients'::regclass", /Cast to regclass/],
		['SELECT ctid FROM patients', /System column ctid/],
		['SELECT current_user', /Only CURRENT_DATE/],
		['SELECT * FROM patients TABLESAMPLE SYSTEM (10)', /TABLESAMPLE/],
		['SELECT $1', /parameters are not supported/],
		['SELEC 1', /does not parse/],
		['', /empty/],
	])('refuses %s', async (sql, message) => {
		await expect(validateAnalyticsSql(sql)).rejects.toThrow(message);
	});

	it('accepts every certified metric, with its period parameter', async () => {
		for (const metric of getMetric.METRICS) {
			for (const groupBy of [undefined, 'week', 'chapter'] as const) {
				await expect(
					validateAnalyticsSql(METRIC_DEFINITIONS[metric].sql({ months: 6, groupBy }), { allowParams: true }),
					metric,
				).resolves.toBeTypeOf('string');
			}
		}
	});
});
