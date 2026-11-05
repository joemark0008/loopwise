import { describe, expect, it } from 'vitest';

import {
	parseReport,
	reportBlocks,
	reportProse,
	ReportSyntaxError,
	resolveKpi,
	ungroundedProseNumbers,
} from './report-blocks';

describe('report blocks', () => {
	it('splits markdown and blocks, in order', () => {
		expect(
			parseReport('# Title\nText\n<chart ref="a"/>\nMore <table ref=\'b\'></table><sections ref="c" />'),
		).toEqual([
			{
				title: null,
				segments: [
					{ kind: 'markdown', text: '# Title\nText\n' },
					{ kind: 'chart', ref: 'a' },
					{ kind: 'markdown', text: '\nMore ' },
					{ kind: 'table', ref: 'b' },
					{ kind: 'sections', ref: 'c' },
				],
			},
		]);
		expect(reportProse('Hi <chart ref="a"/> there')).toBe('Hi \n there');
	});

	it('allows prose numbers found in the embedded results, small counts and years only', () => {
		const results = [
			{
				rows: [
					['40-59', 4],
					['60+', 3],
				],
				snapshot: { subject: 'Maria · 45 y', value: '7.2 %' },
			},
		];
		expect(ungroundedProseNumbers('In 2026, 4 of 7 patients; HbA1c 7.20; age 45.', results)).toEqual([]);
		expect(ungroundedProseNumbers('Average BP 152/96 <table ref="x"/>', results)).toEqual(['152', '96']);
	});

	it('parses grids with widths, and KPI blocks with their attributes', () => {
		const [tab] = parseReport(
			'Intro\n<grid widths="2,1">\n<chart ref="a"/>\n<kpi column="visits" ref="b" compare="percentage" label="Visits"/>\n</grid>\nEnd',
		);
		expect(tab.segments).toEqual([
			{ kind: 'markdown', text: 'Intro\n' },
			{
				kind: 'grid',
				widths: [2, 1],
				blocks: [
					{ kind: 'chart', ref: 'a' },
					{ kind: 'kpi', ref: 'b', column: 'visits', compare: 'percentage', label: 'Visits' },
				],
			},
			{ kind: 'markdown', text: '\nEnd' },
		]);
		expect(parseReport('<grid><table ref="a"/><table ref="b"/></grid>')[0].segments[0]).toMatchObject({
			widths: null,
		});
	});

	it('parses tabs, and lists blocks across tabs and grids', () => {
		const code =
			'<tab title="Overview">Hi <kpi ref="k"/></tab>\n<tab title="Detail"><grid><chart ref="c"/><table ref="t"/></grid></tab>';
		expect(parseReport(code).map((tab) => tab.title)).toEqual(['Overview', 'Detail']);
		expect(reportBlocks(code).map((block) => block.ref)).toEqual(['k', 'c', 't']);
	});

	it('refuses malformed layout', () => {
		const refused = [
			'Text outside <tab title="A">x</tab>',
			'<tab title="A">x</tab> trailing',
			'<tab>no title</tab>',
			'<tab title="A"><tab title="B">x</tab></tab>',
			'<tab title="A">unclosed',
			'<grid><chart ref="a"/></grid>',
			'<grid><chart ref="a"/>text<chart ref="b"/></grid>',
			'<grid widths="2"><chart ref="a"/><chart ref="b"/></grid>',
			'<grid widths="0,1"><chart ref="a"/><chart ref="b"/></grid>',
			'<grid><chart ref="a"/><chart ref="b"/>',
			'<chart title="x"/>',
			'<kpi ref="a" compare="ratio"/>',
		];
		for (const code of refused) {
			expect(() => parseReport(code), code).toThrow(ReportSyntaxError);
		}
	});

	it('guards tab titles and KPI labels like prose', () => {
		const code = '<tab title="Q3 152 visits"><kpi ref="a" label="Up 96"/></tab>';
		expect(reportProse(code)).toContain('Q3 152 visits');
		expect(ungroundedProseNumbers(code, [{ rows: [[1]] }])).toEqual(['152', '96']);
	});

	it('resolves a KPI to the last row, and explains what it cannot show', () => {
		const source = {
			columns: ['month', 'visits', 'patients'],
			rows: [
				['2026-09', 40, 30],
				['2026-10', 52, 35],
			],
		};
		expect(resolveKpi({ kind: 'kpi', ref: 'a', column: 'visits', compare: 'percentage' }, source)).toMatchObject({
			column: 'visits',
			periodColumn: 'month',
			value: 52,
		});
		expect(resolveKpi({ kind: 'kpi', ref: 'a' }, source)).toHaveProperty('problem');
		expect(resolveKpi({ kind: 'kpi', ref: 'a', column: 'nope' }, source)).toHaveProperty('problem');
		expect(
			resolveKpi({ kind: 'kpi', ref: 'a', compare: 'variation' }, { columns: ['n'], rows: [[7]] }),
		).toHaveProperty('problem');
		expect(resolveKpi({ kind: 'kpi', ref: 'a' }, { columns: ['n'], rows: [[7]] })).toMatchObject({ value: 7 });
		expect(resolveKpi({ kind: 'kpi', ref: 'a' }, { columns: ['n'], rows: [[null]] })).toHaveProperty('problem');
	});
});
