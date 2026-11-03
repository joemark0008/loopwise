import { describe, expect, it } from 'vitest';

import { reportProse, splitReport, ungroundedProseNumbers } from './report-blocks';

describe('report blocks', () => {
	it('splits markdown and blocks, in order', () => {
		expect(
			splitReport('# Title\nText\n<chart ref="a"/>\nMore <table ref=\'b\'></table><sections ref="c" />'),
		).toEqual([
			{ kind: 'markdown', text: '# Title\nText\n' },
			{ kind: 'chart', ref: 'a' },
			{ kind: 'markdown', text: '\nMore ' },
			{ kind: 'table', ref: 'b' },
			{ kind: 'sections', ref: 'c' },
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
});
