// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runAnalyticsSql as charts } from '@quarry/shared/tools';
import { ResultChartView, AnalyticsResultToolCall } from './analytics-result';
import type * as Recharts from 'recharts';
import type { runAnalyticsSql } from '@quarry/shared/tools';

// jsdom measures nothing: give the responsive container a fixed size so Recharts draws.
vi.mock('recharts', async (importOriginal) => {
	const recharts = await importOriginal<typeof Recharts>();
	return {
		...recharts,
		ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
			React.cloneElement(children, { width: 600, height: 300 } as never),
	};
});

const columns = ['band', 'patients', 'visits', 'hba1c', 'bmi', 'target'];
const rows: runAnalyticsSql.Cell[][] = [
	['40-59', 4, 9, 7.2, 30, 'Referred'],
	['60+', 3, 5, 6.1, 27.4, 'Treated'],
];

const chartFor = (type: runAnalyticsSql.AnalyticsChartType): runAnalyticsSql.ResultChart => {
	switch (type) {
		case 'scatter':
			return { type, x: 'bmi', y: ['hba1c'] };
		case 'bubble':
			return { type, x: 'bmi', y: ['hba1c'], size: 'visits' };
		case 'sankey':
			return { type, x: 'band', target: 'target', y: ['visits'] };
		case 'pie':
		case 'donut':
		case 'radial_bar':
		case 'treemap':
		case 'funnel':
		case 'horizontal_bar':
			return { type, x: 'band', y: ['visits'] };
		default:
			return { type, x: 'band', y: ['patients', 'visits'] };
	}
};

describe('analytics result charts', () => {
	afterEach(cleanup);

	it.each(charts.ANALYTICS_CHART_TYPES)('draws a %s chart', (type) => {
		const { container } = render(<ResultChartView chart={chartFor(type)} columns={columns} rows={rows} />);
		expect(container.querySelector(`[data-chart-type="${type}"] svg`)).not.toBeNull();
	});

	it('lets the clinician redraw the result as another type that fits it', () => {
		render(
			<AnalyticsResultToolCall
				toolPart={
					{
						type: 'tool-get_metric',
						toolCallId: 't',
						state: 'output-available',
						input: { metric: 'patients_by_age_band' },
						output: {
							metric: 'patients_by_age_band',
							label: 'Patients by age group',
							definition: 'd',
							months: null,
							sql: 'SELECT 1',
							columns,
							rows,
							suppressed: false,
							chart: { type: 'bar', x: 'band', y: ['patients'] },
						},
					} as never
				}
			/>,
		);
		const select = screen.getByTestId('chart-type') as HTMLSelectElement;
		expect([...select.options].map((option) => option.value)).toEqual(
			expect.arrayContaining(['bar', 'line', 'pie', 'funnel', 'treemap']),
		);
		fireEvent.change(select, { target: { value: 'pie' } });
		expect(document.querySelector('[data-chart-type="pie"] svg')).not.toBeNull();
	});
});
