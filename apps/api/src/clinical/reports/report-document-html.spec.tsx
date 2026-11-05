import { describe, expect, it } from 'vitest';

import { renderReportDocumentHtml } from './report-document-html.js';

const visits = {
	toolName: 'get_metric',
	output: {
		label: 'Encounters',
		columns: ['month', 'encounters'],
		rows: [
			['2026-09-01', 40],
			['2026-10-01', 50],
		],
		chart: null,
	},
};

const render = (code: string) =>
	renderReportDocumentHtml(
		{ id: 'r', version: 1, action: 'create', title: 'Panel', code, patientId: null, refs: [] },
		new Map([['call_visits', visits]]),
		{ generatedAt: '2026-11-05T00:00:00Z', generatedBy: 'Dr. Reyes' },
	);

describe('renderReportDocumentHtml', () => {
	it('prints each tab under its title, grids as columns, and a KPI with its change', () => {
		const html = render(
			[
				'<tab title="Overview"><grid widths="2,1"><table ref="call_visits"/><kpi ref="call_visits" column="encounters" compare="percentage" label="Visits"/></grid></tab>',
				'<tab title="Detail"><table ref="call_visits"/></tab>',
			].join('\n'),
		);
		expect(html).toContain('<h2 class="tab-title">Overview</h2>');
		expect(html).toContain('<h2 class="tab-title">Detail</h2>');
		expect(html).toContain('grid-template-columns: minmax(0, 2fr) minmax(0, 1fr)');
		expect(html).toContain('<p class="kpi-value">50</p>');
		expect(html).toMatch(/▲ 25% vs\. /);
	});

	it('prints a report without tabs as before', () => {
		const html = render('# Intro\n<table ref="call_visits"/>');
		expect(html).not.toContain('class="tab-title"');
		expect(html).toContain('<h1>Intro</h1>');
	});
});
