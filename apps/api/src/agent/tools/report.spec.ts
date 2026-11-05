import { describe, expect, it, vi } from 'vitest';

import type { ToolContext } from '../types/tools.js';
import reportTool from './report.js';

const metric = {
	toolName: 'get_metric',
	output: {
		metric: 'patients_by_age_band',
		label: 'Patients by age group',
		columns: ['age_band', 'patients'],
		rows: [
			['40-59', 4],
			['60+', 3],
		],
		chart: { type: 'bar', x: 'age_band', y: ['patients'] },
	},
};
const table = { toolName: 'run_analytics_sql', output: { columns: ['sex'], rows: [['female']], chart: null } };

const setup = (saved: unknown[] = [], savedOutputs: Record<string, unknown> = {}) => {
	const toolOutputs = new Map<string, { toolName: string; output: unknown }>([
		['call_metric', metric],
		['call_table', table],
	]);
	const context = {
		userId: 'u',
		chatId: 'c',
		patientId: undefined,
		toolOutputs,
		services: {
			reports: {
				versions: vi.fn().mockResolvedValue(saved),
				toolOutputs: vi.fn().mockResolvedValue(savedOutputs),
			},
			patients: { isVisible: vi.fn().mockResolvedValue(true) },
		},
	} as unknown as ToolContext;
	let call = 0;
	const run = (input: Parameters<NonNullable<typeof reportTool.execute>>[0]) =>
		reportTool.execute!(input, {
			experimental_context: context,
			toolCallId: `call_report_${++call}`,
			messages: [],
		}) as unknown as Promise<{
			version: number;
			code: string;
			refs: string[];
			title: string;
		}>;
	return { run, context };
};

const code = '# Panel\nYou have 7 patients, 4 aged 40-59.\n<chart ref="call_metric"/>';

describe('report tool', () => {
	it('creates a report embedding a result of this run, then updates and restores it as new versions', async () => {
		const { run } = setup();
		const v1 = await run({ action: 'create', id: 'panel', title: 'Panel', code });
		expect(v1).toMatchObject({ version: 1, refs: ['call_metric'], title: 'Panel' });
		const v2 = await run({ action: 'update', id: 'panel', search: 'You have 7', replace: 'Your panel: 7' });
		expect(v2).toMatchObject({ version: 2, title: 'Panel' });
		expect(v2.code).toContain('Your panel: 7 patients');
		const v3 = await run({ action: 'restore', id: 'panel', version: 1 });
		expect(v3).toMatchObject({ version: 3, code });
	});

	it('numbers versions after the ones saved in earlier turns, and finds their embedded results', async () => {
		const saved = [{ id: 'panel', version: 4, action: 'create', title: 'Panel', code, patientId: null, refs: [] }];
		const { run, context } = setup(saved, { call_old: metric });
		const next = await run({ action: 'replace', id: 'panel', code: 'Older data <table ref="call_old"/>' });
		expect(next.version).toBe(5);
		expect(context.services.reports.toolOutputs).toHaveBeenCalledWith('u', 'c', ['call_old']);
	});

	it('refuses an id that is not a tool call of the chat, a block that cannot show the result, and a missing chart', async () => {
		const { run } = setup();
		await expect(
			run({ action: 'create', id: 'r', title: 'R', code: '<chart ref="call_made_up"/>' }),
		).rejects.toThrow(/not a tool call of this chat/);
		await expect(
			run({ action: 'create', id: 'r', title: 'R', code: '<sections ref="call_metric"/>' }),
		).rejects.toThrow(/can't show a get_metric result/);
		await expect(run({ action: 'create', id: 'r', title: 'R', code: '<chart ref="call_table"/>' })).rejects.toThrow(
			/has no chart/,
		);
	});

	it('refuses prose with a number none of its embedded results holds', async () => {
		const { run } = setup();
		await expect(
			run({ action: 'create', id: 'r', title: 'R', code: 'HbA1c averages 8.4%. <chart ref="call_metric"/>' }),
		).rejects.toThrow(/numbers none of its embedded results contains \(8\.4\)/);
	});

	it('creates once, and updates only an exact string of the current code', async () => {
		const { run } = setup();
		await run({ action: 'create', id: 'r', title: 'R', code });
		await expect(run({ action: 'create', id: 'r', title: 'R', code })).rejects.toThrow(/exists \(v1\)/);
		await expect(run({ action: 'update', id: 'r', search: 'not in it', replace: 'x' })).rejects.toThrow(
			/search was not found/,
		);
	});

	it('lays blocks out in tabs and grids, with a KPI of a result', async () => {
		const { run } = setup();
		const layout = [
			'<tab title="Overview">',
			'<grid widths="2,1"><chart ref="call_metric"/><kpi ref="call_metric" column="patients" compare="variation"/></grid>',
			'</tab>',
			'<tab title="Detail"><table ref="call_table"/></tab>',
		].join('\n');
		const created = await run({ action: 'create', id: 'r', title: 'R', code: layout });
		expect(created.refs).toEqual(['call_metric', 'call_metric', 'call_table']);
	});

	it('refuses malformed layout and a KPI its result cannot show', async () => {
		const { run } = setup();
		await expect(
			run({
				action: 'create',
				id: 'r',
				title: 'R',
				code: 'Intro <tab title="A"><table ref="call_table"/></tab>',
			}),
		).rejects.toThrow(/layout doesn't parse: A report with tabs/);
		await expect(
			run({ action: 'create', id: 'r', title: 'R', code: '<grid><table ref="call_table"/></grid>' }),
		).rejects.toThrow(/2–4 blocks/);
		await expect(
			run({ action: 'create', id: 'r', title: 'R', code: '<kpi ref="call_metric" column="age_band"/>' }),
		).rejects.toThrow(/no number in the last row/);
		await expect(run({ action: 'create', id: 'r', title: 'R', code: '<kpi ref="call_table"/>' })).rejects.toThrow(
			/no numeric column/,
		);
	});
});
