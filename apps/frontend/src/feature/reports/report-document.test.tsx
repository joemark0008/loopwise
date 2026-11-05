// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render as renderUi, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ReportDocument } from './report-document';
import type { report } from '@loopwise/shared/tools';

const outputs = new Map([
	[
		'call_visits',
		{
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
		},
	],
]);

const render = (ui: React.ReactElement) =>
	renderUi(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

const doc = (code: string): report.Output => ({
	id: 'r',
	version: 1,
	action: 'create',
	title: 'Panel',
	code,
	patientId: null,
	refs: [],
});

describe('ReportDocument', () => {
	afterEach(cleanup);

	it('shows one tab at a time, with a grid of a table and a KPI', () => {
		render(
			<ReportDocument
				doc={doc(
					'<tab title="Overview"><grid widths="2,1"><table ref="call_visits"/><kpi ref="call_visits" compare="percentage" label="Visits"/></grid></tab><tab title="Notes">Read with the chart.</tab>',
				)}
				outputs={outputs}
			/>,
		);
		expect(screen.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected')).toBe('true');
		expect(screen.getByText('Visits')).toBeTruthy();
		expect(screen.getByText('25%')).toBeTruthy();
		expect(screen.queryByText('Read with the chart.')).toBeNull();

		fireEvent.click(screen.getByRole('tab', { name: 'Notes' }));
		expect(screen.getByText('Read with the chart.')).toBeTruthy();
		expect(screen.queryByText('Visits')).toBeNull();
	});

	it('says so when a layout does not parse, instead of failing', () => {
		render(<ReportDocument doc={doc('<grid><table ref="call_visits"/></grid>')} outputs={outputs} />);
		expect(screen.getByText("This report's layout can't be shown.")).toBeTruthy();
	});
});
