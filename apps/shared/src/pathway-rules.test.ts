import { describe, expect, it } from 'vitest';

import {
	describeNumericBand,
	normalizeUnit,
	parsePathwayDefinition,
	type PathwayDefinitionInput,
	PathwayDefinitionSchema,
	stepSlaHours,
} from './pathway-rules';

const band = (min: number | undefined, below: number | undefined, extra: Record<string, unknown> = {}) => ({
	...(min !== undefined && { min }),
	...(below !== undefined && { below }),
	classification: 'actionable' as const,
	urgency: 'soon' as const,
	reason: 'High.',
	guideline: 'Test guideline',
	nextState: 'notified' as const,
	...extra,
});

const valid = (): PathwayDefinitionInput => ({
	key: 'test',
	name: 'Test pathway',
	version: 1,
	rules: {
		schemaVersion: 2,
		source: 'Test guideline',
		triggers: [
			{
				code: '1-1',
				display: 'Test',
				type: 'numeric',
				unit: 'mg/dL',
				conversions: [{ from: ['mmol/L'], factor: 18 }],
				bands: [
					band(undefined, 10, { classification: 'normal', urgency: 'routine' }),
					band(10, 20),
					band(20, undefined, { classification: 'critical', urgency: 'critical', nextState: 'escalated' }),
				],
			},
			{
				code: '2-2',
				display: 'Coded',
				type: 'coded',
				valuePattern: '^cat\\s*([0-9])',
				bands: [{ ...band(undefined, undefined), values: ['1'] }],
			},
		],
		criticalFlag: { nextState: 'escalated', slaHours: 1 },
	},
	steps: [
		{ state: 'open', label: 'Review', slaHours: 48 },
		{ state: 'notified', label: 'Tell', slaHours: 24 },
		{ state: 'closed', label: 'Done' },
	],
	slas: { resultReviewHours: 48, criticalAlertHours: 1 },
	closureRequirements: { anyOf: ['signoff'], signoffNeedsReason: true, description: 'Sign-off.' },
});

const problems = (definition: unknown) => {
	const parsed = PathwayDefinitionSchema.safeParse(definition);
	return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
};

/** Mutates a fresh valid definition. */
const withChange = (change: (definition: PathwayDefinitionInput & Record<string, never>) => void) => {
	const definition = valid() as PathwayDefinitionInput & Record<string, never>;
	change(definition);
	return definition;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests reach into the union of trigger types
const trigger = (definition: PathwayDefinitionInput, index = 0): any => definition.rules.triggers[index];

describe('PathwayDefinitionSchema', () => {
	it('accepts a valid definition and fills defaults', () => {
		const parsed = parsePathwayDefinition(valid());
		expect(parsed.rules.triggers[0].codeSystem).toBe('LOINC');
		expect(parsed.rules.triggers[0].type === 'numeric' && parsed.rules.triggers[0].conversions[0].offset).toBe(0);
	});

	it('refuses another schema version', () => {
		expect(problems(withChange((d) => ((d.rules as { schemaVersion: number }).schemaVersion = 1)))).not.toEqual([]);
	});

	it('refuses numeric bands with a gap, an overlap or an open end', () => {
		expect(problems(withChange((d) => (trigger(d).bands[1].min = 11)))).toContain(
			'1-1: band 2 must start where band 1 ends.',
		);
		expect(problems(withChange((d) => (trigger(d).bands[1].min = 9)))).toContain(
			'1-1: band 2 must start where band 1 ends.',
		);
		expect(problems(withChange((d) => (trigger(d).bands[0].min = 0)))).toContain(
			'1-1: the first band must have no lower bound.',
		);
		expect(problems(withChange((d) => (trigger(d).bands[2].below = 99)))).toContain(
			'1-1: the last band must have no upper bound.',
		);
	});

	it('refuses an empty band', () => {
		expect(
			problems(
				withChange((d) => {
					trigger(d).bands[1].below = 10;
					trigger(d).bands[2].min = 10;
				}),
			),
		).toContain('1-1: band 2 is empty.');
	});

	it('refuses a next state the pathway lacks', () => {
		expect(problems(withChange((d) => (trigger(d).bands[1].nextState = 'confirming')))).toContain(
			'Band 2 of 1-1: nextState "confirming" is not a step of this pathway.',
		);
		expect(problems(withChange((d) => (d.rules.criticalFlag.nextState = 'referred')))).toEqual([
			'criticalFlag.nextState "referred" is not a step of this pathway.',
		]);
	});

	it('keeps classification and urgency consistent', () => {
		expect(problems(withChange((d) => (trigger(d).bands[2].urgency = 'urgent')))).toContain(
			'Band 3 of 1-1: a critical classification needs critical urgency.',
		);
		expect(problems(withChange((d) => (trigger(d).bands[0].urgency = 'soon')))).toContain(
			'Band 1 of 1-1: a normal result is routine.',
		);
	});

	it('needs steps from open to closed, each once, without the any-step states', () => {
		expect(problems(withChange((d) => d.steps.shift()))).toContain('The first step must be "open".');
		expect(problems(withChange((d) => d.steps.pop()))).toContain('The last step must be "closed".');
		expect(problems(withChange((d) => d.steps.splice(1, 0, { state: 'open', label: 'Again' })))).toContain(
			'Step "open" is listed twice.',
		);
		expect(problems(withChange((d) => d.steps.splice(1, 0, { state: 'escalated', label: 'x' })))).toContain(
			'"escalated" applies to every pathway; don\'t list it as a step.',
		);
	});

	it('refuses a duplicate trigger, unit or coded value, and a broken pattern', () => {
		expect(problems(withChange((d) => (trigger(d, 1).code = '1-1')))).toContain('Code 1-1 has two triggers.');
		expect(problems(withChange((d) => (trigger(d).unitAliases = ['MG/DL'])))).toContain(
			'1-1: a unit is listed twice.',
		);
		expect(problems(withChange((d) => trigger(d, 1).bands.push({ ...trigger(d, 1).bands[0] })))).toContain(
			'2-2: value "1" is in two bands.',
		);
		expect(problems(withChange((d) => (trigger(d, 1).valuePattern = '([0-9]')))).toContain(
			'2-2: valuePattern is not a valid pattern.',
		);
	});

	it('names the pathway and every problem when parsing fails', () => {
		expect(() => parsePathwayDefinition(withChange((d) => (trigger(d).bands[1].min = 11)))).toThrow(
			/^Pathway test is invalid:\nrules\.triggers\.0\.bands\.1\.min: 1-1: band 2 must start where band 1 ends\.$/,
		);
	});
});

describe('helpers', () => {
	it('normalizes units', () => {
		expect(normalizeUnit(' mmol / L ')).toBe('mmol/l');
	});

	it('describes bands', () => {
		expect(describeNumericBand({ below: 5.7 }, '%')).toBe('< 5.7 %');
		expect(describeNumericBand({ min: 5.7, below: 6.5 }, '%')).toBe('5.7 – < 6.5 %');
		expect(describeNumericBand({ min: 12 }, '%')).toBe('≥ 12 %');
		expect(describeNumericBand({}, '%')).toBe('any value');
	});

	it('reads step SLAs, with the critical alert SLA for escalated', () => {
		const definition = parsePathwayDefinition(valid());
		expect(stepSlaHours(definition, 'notified')).toBe(24);
		expect(stepSlaHours(definition, 'closed')).toBeUndefined();
		expect(stepSlaHours(definition, 'escalated')).toBe(1);
	});
});
