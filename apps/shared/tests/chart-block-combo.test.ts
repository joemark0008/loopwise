import { describe, expect, it } from 'vitest';

import { buildStoryChartBlock } from '../src/chart-block';
import { parseChartBlock } from '../src/story-segments';
import { ChartInputSchema } from '../src/tools/display-chart';

describe('combo chart input schema', () => {
	it('accepts a mixed-series dual-axis chart', () => {
		const result = ChartInputSchema.safeParse({
			query_id: 'q1',
			chart_type: 'mixed',
			x_axis_key: 'month',
			x_axis_type: 'category',
			series: [
				{ data_key: 'revenue', series_type: 'bar', y_axis: 'left' },
				{ data_key: 'conversion_rate', series_type: 'line', y_axis: 'right' },
			],
			y_axis_label: 'Revenue',
			y_axis_right_min: 0,
			y_axis_right_max: 100,
			y_axis_right_label: 'Conversion rate',
			title: 'Revenue vs. conversion rate',
		});
		expect(result.success).toBe(true);
	});

	it('rejects an inverted right-axis range', () => {
		const result = ChartInputSchema.safeParse({
			query_id: 'q1',
			chart_type: 'bar',
			x_axis_key: 'month',
			x_axis_type: 'category',
			series: [{ data_key: 'orders', series_type: 'line', y_axis: 'right' }],
			y_axis_right_min: 100,
			y_axis_right_max: 0,
			title: 'Orders',
		});
		expect(result.success).toBe(false);
	});
});

describe('combo chart block round-trip', () => {
	it('preserves series_type, y_axis and per-axis configuration', () => {
		const block = buildStoryChartBlock({
			query_id: 'q1',
			chart_type: 'mixed',
			x_axis_key: 'month',
			x_axis_type: 'category',
			series: [
				{ data_key: 'revenue', series_type: 'bar', y_axis: 'left' },
				{ data_key: 'orders', series_type: 'line', y_axis: 'right' },
			],
			y_axis_label: 'Revenue',
			y_axis_right_min: 0,
			y_axis_right_max: 100,
			y_axis_right_label: 'Orders',
			title: 'Revenue vs. orders',
		});

		const attrString = block.match(/^<chart\s+([\s\S]*?)\s*\/?>$/)?.[1];
		expect(attrString).toBeDefined();

		const parsed = parseChartBlock(attrString ?? '');
		expect(parsed?.series).toEqual([
			{ data_key: 'revenue', series_type: 'bar', y_axis: 'left' },
			{ data_key: 'orders', series_type: 'line', y_axis: 'right' },
		]);
		expect(parsed?.yAxisLabel).toBe('Revenue');
		expect(parsed?.yAxisRightMin).toBe(0);
		expect(parsed?.yAxisRightMax).toBe(100);
		expect(parsed?.yAxisRightLabel).toBe('Orders');
	});
});
