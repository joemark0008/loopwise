import { parsePathwayDefinition, type PathwayDefinition } from '@loopwise/shared/pathway-rules';
import { extractCode, parseNumericValue, type RuleInput, RulesEngine } from '@loopwise/shared/rules-engine';
import { describe, expect, it } from 'vitest';

import { PATHWAY_DEFINITIONS } from './pathway-definitions.js';

/** The seeded pathways, through the same validation as the API's load. */
const PATHWAYS = PATHWAY_DEFINITIONS.map(parsePathwayDefinition);

const HBA1C = '4548-4';
const FBS = '1558-6';
const POTASSIUM = '2823-3';
const MAMMOGRAM = '24606-6';

const evaluate = (input: Partial<RuleInput> & Pick<RuleInput, 'code' | 'value'>, pathways = PATHWAYS) =>
	RulesEngine.evaluate(input, pathways);

/** The classification, urgency and next state of one value, for the boundary tables. */
const outcome = (code: string, value: string, unit: string | null) => {
	const evaluation = evaluate({ code, value, unit });
	return evaluation && [evaluation.classification, evaluation.urgency, evaluation.nextState];
};

describe('seeded pathways', () => {
	it('all follow the rules schema', () => {
		expect(PATHWAYS.map((pathway) => pathway.key)).toEqual(['diabetes', 'breast', 'potassium']);
	});

	it('cite a guideline in every band', () => {
		for (const pathway of PATHWAYS) {
			for (const trigger of pathway.rules.triggers) {
				for (const band of trigger.bands) {
					expect(band.guideline.length, `${pathway.key} ${trigger.code}`).toBeGreaterThan(10);
				}
			}
		}
	});

	it('diabetes confirms; a BI-RADS 4 goes straight to referred', () => {
		const states = (key: string) => PATHWAYS.find((p) => p.key === key)!.steps.map((s) => s.state);
		expect(states('diabetes')).toContain('confirming');
		expect(states('breast')).not.toContain('confirming');
		expect(evaluate({ code: MAMMOGRAM, value: 'BI-RADS 4' })?.nextState).toBe('referred');
	});
});

describe('RulesEngine: HbA1c (%)', () => {
	it.each([
		['4.0', ['normal', 'routine', 'notified']],
		['5.69', ['normal', 'routine', 'notified']],
		['5.7', ['actionable', 'routine', 'notified']],
		['6.4', ['actionable', 'routine', 'notified']],
		['6.49', ['actionable', 'routine', 'notified']],
		['6.5', ['actionable', 'soon', 'confirming']],
		['9.99', ['actionable', 'soon', 'confirming']],
		['10', ['actionable', 'urgent', 'confirming']],
		['11.9', ['actionable', 'urgent', 'confirming']],
		['12', ['critical', 'critical', 'escalated']],
		['18.5', ['critical', 'critical', 'escalated']],
	])('%s %% → %j', (value, expected) => {
		expect(outcome(HBA1C, value, '%')).toEqual(expected);
	});

	it('explains the rule that fired', () => {
		expect(evaluate({ code: HBA1C, value: '7.2', unit: '%', flag: 'high' })).toEqual({
			pathwayKey: 'diabetes',
			pathwayVersion: 2,
			classification: 'actionable',
			urgency: 'soon',
			reason: 'HbA1c ≥ 6.5 %: diabetes range. Confirm with a repeat test (ADA: two abnormal results).',
			guideline: expect.stringContaining('ADA Standards of Care'),
			nextState: 'confirming',
			slaHours: 14 * 24,
			basis: 'band',
			rule: {
				code: HBA1C,
				display: 'Hemoglobin A1c',
				band: '6.5 – < 10 %',
				comparedValue: 7.2,
				comparedUnit: '%',
				received: '7.2 %',
			},
		});
	});

	it('takes the SLA from the band when it has one, else from the next step', () => {
		expect(evaluate({ code: HBA1C, value: '10.5', unit: '%' })?.slaHours).toBe(72);
		expect(evaluate({ code: HBA1C, value: '5.9', unit: '%' })?.slaHours).toBe(48);
		// A critical value has the pathway's critical alert SLA.
		expect(evaluate({ code: HBA1C, value: '12.1', unit: '%' })?.slaHours).toBe(1);
	});

	it('prefers the parsed numeric value over the text', () => {
		expect(evaluate({ code: HBA1C, value: 'see note', valueNumeric: 6.6, unit: '%' })?.rule.comparedValue).toBe(
			6.6,
		);
	});
});

describe('RulesEngine: unit conversion', () => {
	it.each([
		// IFCC thresholds: 39 mmol/mol = 5.7 %, 48 = 6.5 %, 86 ≈ 10.02 %, 108 ≈ 12.03 %.
		['38', ['normal', 'routine', 'notified']],
		['39', ['actionable', 'routine', 'notified']],
		['47', ['actionable', 'routine', 'notified']],
		['48', ['actionable', 'soon', 'confirming']],
		['85', ['actionable', 'soon', 'confirming']],
		['86', ['actionable', 'urgent', 'confirming']],
		['107', ['actionable', 'urgent', 'confirming']],
		['108', ['critical', 'critical', 'escalated']],
	])('HbA1c %s mmol/mol → %j', (value, expected) => {
		expect(outcome(HBA1C, value, 'mmol/mol')).toEqual(expected);
	});

	it('states the conversion in the reason', () => {
		const evaluation = evaluate({ code: HBA1C, value: '48', unit: 'mmol/mol' });
		expect(evaluation?.rule.comparedValue).toBeCloseTo(6.54304, 5);
		expect(evaluation?.reason).toContain('(48 mmol/mol = 6.54304 %)');
	});

	it.each([
		// 7.0 mmol/L = 126.1 mg/dL; 5.6 = 100.9; 3.9 = 70.3; 3.0 = 54.0; 2.2 = 39.6.
		['6.9', ['actionable', 'routine', 'notified']],
		['7.0', ['actionable', 'soon', 'confirming']],
		['5.5', ['normal', 'routine', 'notified']],
		['5.6', ['actionable', 'routine', 'notified']],
		['3.9', ['normal', 'routine', 'notified']],
		['3.8', ['actionable', 'soon', 'seen']],
		['2.9', ['actionable', 'urgent', 'seen']],
		['2.3', ['actionable', 'urgent', 'seen']],
		['2.2', ['critical', 'critical', 'escalated']],
		['22.3', ['critical', 'critical', 'escalated']],
	])('glucose %s mmol/L → %j', (value, expected) => {
		expect(outcome(FBS, value, 'mmol/L')).toEqual(expected);
	});

	it('matches units regardless of case and spaces', () => {
		expect(outcome(FBS, '130', 'MG / DL')).toEqual(['actionable', 'soon', 'confirming']);
		expect(outcome(FBS, '7.0', 'mmol/l')).toEqual(['actionable', 'soon', 'confirming']);
		expect(outcome(POTASSIUM, '6.5', 'mEq/L')).toEqual(['critical', 'critical', 'escalated']);
	});

	it('reads a value without a unit in the rule’s unit, and says so', () => {
		const evaluation = evaluate({ code: HBA1C, value: '6.8', unit: null });
		expect(evaluation?.classification).toBe('actionable');
		expect(evaluation?.reason).toContain('no unit sent; read as %');
	});

	it('sends a result with an unknown unit to a clinician instead of guessing', () => {
		const evaluation = evaluate({ code: FBS, value: '7', unit: 'g/L' });
		expect(evaluation).toMatchObject({
			basis: 'unrecognised',
			classification: 'actionable',
			urgency: 'routine',
			nextState: 'open',
			slaHours: 48,
			rule: { band: null, comparedValue: null },
		});
		expect(evaluation?.reason).toContain('unit "g/L" is not one this rule knows (expects mg/dL)');
	});
});

describe('RulesEngine: fasting glucose (mg/dL)', () => {
	it.each([
		['39', ['critical', 'critical', 'escalated']],
		['40', ['actionable', 'urgent', 'seen']],
		['53', ['actionable', 'urgent', 'seen']],
		['54', ['actionable', 'soon', 'seen']],
		['69', ['actionable', 'soon', 'seen']],
		['70', ['normal', 'routine', 'notified']],
		['99', ['normal', 'routine', 'notified']],
		['100', ['actionable', 'routine', 'notified']],
		['125', ['actionable', 'routine', 'notified']],
		['126', ['actionable', 'soon', 'confirming']],
		['249', ['actionable', 'soon', 'confirming']],
		['250', ['actionable', 'urgent', 'confirming']],
		['399', ['actionable', 'urgent', 'confirming']],
		['400', ['critical', 'critical', 'escalated']],
	])('%s mg/dL → %j', (value, expected) => {
		expect(outcome(FBS, value, 'mg/dL')).toEqual(expected);
	});
});

describe('RulesEngine: potassium (mmol/L)', () => {
	it.each([
		['2.4', ['critical', 'critical', 'escalated']],
		['2.5', ['actionable', 'urgent', 'seen']],
		['2.9', ['actionable', 'urgent', 'seen']],
		['3.0', ['actionable', 'soon', 'seen']],
		['3.4', ['actionable', 'soon', 'seen']],
		['3.5', ['normal', 'routine', 'notified']],
		['5.4', ['normal', 'routine', 'notified']],
		['5.5', ['actionable', 'soon', 'seen']],
		['5.9', ['actionable', 'soon', 'seen']],
		['6.0', ['actionable', 'urgent', 'seen']],
		['6.4', ['actionable', 'urgent', 'seen']],
		['6.5', ['critical', 'critical', 'escalated']],
		['7.8', ['critical', 'critical', 'escalated']],
	])('%s mmol/L → %j', (value, expected) => {
		expect(outcome(POTASSIUM, value, 'mmol/L')).toEqual(expected);
	});
});

describe('RulesEngine: mammogram (coded BI-RADS)', () => {
	it.each([
		['BI-RADS 0', ['actionable', 'soon', 'referred']],
		['BI-RADS 1', ['normal', 'routine', 'notified']],
		['BI-RADS 2', ['normal', 'routine', 'notified']],
		['BI-RADS 3', ['actionable', 'routine', 'notified']],
		['BI-RADS 4', ['actionable', 'urgent', 'referred']],
		['BI-RADS 4A', ['actionable', 'urgent', 'referred']],
		['BI-RADS Category 4C', ['actionable', 'urgent', 'referred']],
		['BI-RADS 5', ['actionable', 'urgent', 'referred']],
		['BI-RADS 6', ['actionable', 'soon', 'referred']],
		['4', ['actionable', 'urgent', 'referred']],
		['birads: 0', ['actionable', 'soon', 'referred']],
		['Category 3', ['actionable', 'routine', 'notified']],
		['ACR BI-RADS 2 benign', ['normal', 'routine', 'notified']],
	])('%s → %j', (value, expected) => {
		expect(outcome(MAMMOGRAM, value, null)).toEqual(expected);
	});

	it('names the category in the explanation', () => {
		const evaluation = evaluate({ code: MAMMOGRAM, value: 'BI-RADS 5' });
		expect(evaluation?.rule.band).toBe('BI-RADS 5');
		expect(evaluation?.slaHours).toBe(24);
		expect(evaluation?.guideline).toContain('ACR BI-RADS Atlas');
	});

	it.each(['BI-RADS 7', '45', 'mass seen, see report', ''])('sends "%s" to a clinician', (value) => {
		expect(evaluate({ code: MAMMOGRAM, value })).toMatchObject({
			basis: 'unrecognised',
			classification: 'actionable',
			nextState: 'open',
		});
	});
});

describe('RulesEngine: lab critical flags', () => {
	it('raise a normal band to actionable and urgent, and escalate', () => {
		expect(evaluate({ code: POTASSIUM, value: '5.0', unit: 'mmol/L', flag: 'critical_high' })).toMatchObject({
			basis: 'critical_flag',
			classification: 'actionable',
			urgency: 'urgent',
			nextState: 'escalated',
			slaHours: 1,
			reason: expect.stringMatching(/^The lab flagged this result critical high; the pathway rule alone says: /),
		});
	});

	it('raise a routine or soon band to urgent', () => {
		expect(outcome(HBA1C, '7.0', '%')).toEqual(['actionable', 'soon', 'confirming']);
		const flagged = evaluate({ code: HBA1C, value: '7.0', unit: '%', flag: 'critical_low' });
		expect([flagged?.classification, flagged?.urgency, flagged?.basis]).toEqual([
			'actionable',
			'urgent',
			'critical_flag',
		]);
		expect(flagged?.reason).toContain('critical low');
	});

	it('leave an urgent or critical band as it is', () => {
		expect(evaluate({ code: HBA1C, value: '11', unit: '%', flag: 'critical_high' })).toMatchObject({
			basis: 'band',
			urgency: 'urgent',
			nextState: 'confirming',
		});
		expect(evaluate({ code: HBA1C, value: '12.1', unit: '%', flag: 'critical_high' })).toMatchObject({
			basis: 'band',
			classification: 'critical',
			urgency: 'critical',
		});
	});

	it('make an unreadable result urgent', () => {
		expect(evaluate({ code: FBS, value: 'hemolysed', unit: 'mg/dL', flag: 'critical_high' })).toMatchObject({
			basis: 'unrecognised',
			urgency: 'urgent',
			nextState: 'escalated',
			slaHours: 1,
		});
	});

	it.each(['high', 'low', 'abnormal', 'normal'] as const)('ignore the %s flag', (flag) => {
		expect(evaluate({ code: HBA1C, value: '5.0', unit: '%', flag })).toMatchObject({
			basis: 'band',
			classification: 'normal',
		});
	});
});

describe('RulesEngine: no matching pathway', () => {
	it('returns null for a code no pathway lists', () => {
		expect(evaluate({ code: '2160-0', value: '1.1', unit: 'mg/dL' })).toBeNull();
	});

	it('returns null for the right code in another code system', () => {
		expect(evaluate({ code: HBA1C, codeSystem: 'LOCAL', value: '7', unit: '%' })).toBeNull();
	});

	it('returns null without pathways, e.g. when the pathway is inactive', () => {
		expect(evaluate({ code: HBA1C, value: '7', unit: '%' }, [])).toBeNull();
	});
});

describe('RulesEngine: several pathways on one code', () => {
	const diabetes = PATHWAYS.find((p) => p.key === 'diabetes')!;
	/** A made-up pathway that calls every HbA1c ≥ 6 critical. */
	const strict: PathwayDefinition = {
		...diabetes,
		key: 'aaa-strict',
		rules: {
			...diabetes.rules,
			triggers: [
				{
					...(diabetes.rules.triggers[0] as Extract<
						PathwayDefinition['rules']['triggers'][number],
						{ type: 'numeric' }
					>),
					bands: [
						{ ...diabetes.rules.triggers[0].bands[0], below: 6 },
						{
							...diabetes.rules.triggers[0].bands[4],
							min: 6,
							reason: 'strict',
						},
					],
				},
			],
		},
	};

	it('picks the most serious evaluation, whatever the order', () => {
		expect(evaluate({ code: HBA1C, value: '7', unit: '%' }, [diabetes, strict])?.pathwayKey).toBe('aaa-strict');
		expect(evaluate({ code: HBA1C, value: '7', unit: '%' }, [strict, diabetes])?.pathwayKey).toBe('aaa-strict');
	});

	it('breaks a tie by pathway key', () => {
		expect(evaluate({ code: HBA1C, value: '5', unit: '%' }, [diabetes, strict])?.pathwayKey).toBe('aaa-strict');
	});

	it('is deterministic', () => {
		const input = { code: HBA1C, value: '9.1', unit: '%', flag: 'high' as const };
		expect(evaluate(input)).toEqual(evaluate(input));
	});
});

describe('value parsing', () => {
	it.each([
		['7.2', 7.2],
		[' 7.2 ', 7.2],
		['>14', 14],
		['<= 4', 4],
		['.5', 0.5],
		['7,2', null],
		['7.2 %', null],
		['', null],
	])('parseNumericValue(%j) = %j', (value, expected) => {
		expect(parseNumericValue(value)).toBe(expected);
	});

	it('extracts a coded value with or without a pattern', () => {
		expect(extractCode(' 3 ', undefined)).toBe('3');
		expect(extractCode('BI-RADS 4b', String.raw`BI-RADS\s*([0-6])`)).toBe('4');
		expect(extractCode('none', String.raw`([0-6])`)).toBeNull();
	});
});
