import z from 'zod/v3';

export const ACTIONS = ['create', 'update', 'replace', 'restore'] as const;

export const description = [
	'Write or change a report that opens in a side panel next to the chat, like a document the clinician reads, prints',
	'and downloads as a PDF. The content is markdown you write (title sections, a short narrative) plus blocks that',
	'embed results of tools you already called in this chat, by their tool call id: <chart ref="ID"/> for a',
	'chart_patient_trend chart or a run_analytics_sql / get_metric result that has a chart, <table ref="ID"/> for a',
	'run_analytics_sql / get_metric result, <sections ref="ID"/> for the data of a create_report summary, and',
	'<kpi ref="ID" column="COL" label="..." compare="percentage|variation|absolute"/> for a headline number: the last',
	'row of a run_analytics_sql / get_metric column (column may be left out when the result has one numeric column);',
	'compare adds the change from the row before, so the query must return one row per period, oldest first. Layout:',
	'<grid widths="2,1">...</grid> puts 2-4 blocks side by side (blocks only inside; widths optional, one whole number',
	'per block, e.g. a wide chart next to a KPI); <tab title="...">...</tab> splits a long report into tabs, and then',
	'the whole report is tabs. Default to one flowing report: use tabs only when asked or for clearly separate parts',
	'(overview vs detail, one topic per tab). Get the data first, then write the report. Every number must come from',
	'those blocks: prose, tab titles or KPI labels with a number that none of the embedded results contains are',
	'refused. Actions: create (id, title, code); update (search/replace an exact string of',
	'the current code, for small edits like "make it shorter" or "add a chart"); replace (the whole code); restore',
	'(version: bring an earlier version back as the newest). Each change is a new version the clinician can step back',
	'to. Nothing is saved to the patient chart: the clinician does that from the panel.',
].join(' ');

export const InputSchema = z.object({
	action: z.enum(ACTIONS),
	id: z
		.string()
		.regex(/^[a-z0-9][a-z0-9-]{1,60}$/)
		.describe('Kebab-case report id, e.g. "panel-november"; the same id for every change to one report.'),
	title: z.string().max(120).optional().describe('Report title (create; optional on later actions).'),
	patientId: z
		.string()
		.optional()
		.describe(
			'The patient the report is about, if one (defaults to the chart chat patient). Enables Save to chart.',
		),
	code: z.string().max(20000).optional().describe('create / replace: the full markdown with blocks.'),
	search: z.string().optional().describe('update: an exact string of the current code to replace.'),
	replace: z.string().optional().describe('update: the new text for `search`.'),
	version: z.number().int().min(1).optional().describe('restore: the version to bring back.'),
});

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	id: z.string(),
	version: z.number(),
	action: z.enum(ACTIONS),
	title: z.string(),
	code: z.string(),
	patientId: z.string().nullable(),
	/** The tool calls the blocks embed. */
	refs: z.array(z.string()),
});

export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;
