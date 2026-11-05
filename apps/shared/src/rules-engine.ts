import {
	type CaseState,
	type CodedTrigger,
	describeNumericBand,
	normalizeUnit,
	type NumericTrigger,
	type PathwayDefinition,
	RESULT_CLASSIFICATIONS,
	type ResultClassification,
	type ResultFlag,
	stepSlaHours,
	URGENCIES,
	type Urgency,
} from './pathway-rules';

/**
 * The rules engine (DESIGN.md §4.4 "rules-first decisions", §4.2 "actionable? urgency?", §4.3 step 3): a pure function
 * from a result and the active pathways to one explainable evaluation. No AI, no clock, no I/O: the same input always
 * gives the same output, and the output says which rule fired and why.
 */

/** The parts of a `Result` row the engine reads. */
export interface RuleInput {
	code: string;
	codeSystem?: string | null;
	/** The value as sent (HL7 OBX-5): a number, a coded value or text. */
	value: string;
	/** The value parsed by ingest, when numeric. */
	valueNumeric?: number | null;
	unit?: string | null;
	/** The lab's flag (OBX-8). */
	flag?: ResultFlag | null;
}

/** How the evaluation was reached. */
export type EvaluationBasis =
	/** A band of the pathway matched. */
	| 'band'
	/** The lab's critical flag raised a less urgent band. */
	| 'critical_flag'
	/** The pathway applies but the value couldn't be classified (unknown unit, unreadable value or code). */
	| 'unrecognised';

export interface RuleEvaluation {
	pathwayKey: string;
	/** The pathway version the rule came from (stored as `rule_version`). */
	pathwayVersion: number;
	classification: ResultClassification;
	urgency: Urgency;
	reason: string;
	guideline: string;
	/** The case state the case engine should aim for (DESIGN.md §6). */
	nextState: CaseState;
	/** Hours allowed in `nextState` before the case escalates. */
	slaHours: number | null;
	basis: EvaluationBasis;
	/** The rule that fired, for the explanation: the band's range or codes, and the value as compared. */
	rule: {
		code: string;
		display: string;
		/** "6.5 – < 10 %" or "BI-RADS 4". */
		band: string | null;
		/** The value in the band's unit, when numeric. */
		comparedValue: number | null;
		comparedUnit: string | null;
		/** The value as received, with its unit. */
		received: string;
	};
}

const CRITICAL_FLAGS: ReadonlySet<ResultFlag> = new Set(['critical_low', 'critical_high']);

const rank = <T extends string>(order: readonly T[], value: T) => order.indexOf(value);
const atLeast = <T extends string>(order: readonly T[], value: T, floor: T): T =>
	rank(order, value) >= rank(order, floor) ? value : floor;

/** Rounds away binary noise from unit conversions (0.09148 × 48 + 2.152), never to a clinical precision. */
const clean = (value: number) => Math.round(value * 1e6) / 1e6;

export const RulesEngine = {
	/**
	 * Evaluates `result` against `pathways` (active ones only; the caller filters). Returns `null` when no pathway
	 * applies to the result's code. When several do, the most serious evaluation wins, then the pathway key, so the
	 * outcome never depends on load order.
	 */
	evaluate(result: RuleInput, pathways: readonly PathwayDefinition[]): RuleEvaluation | null {
		const system = result.codeSystem ?? 'LOINC';
		const evaluations = pathways.flatMap((pathway) =>
			pathway.rules.triggers
				.filter((trigger) => trigger.code === result.code.trim() && trigger.codeSystem === system)
				.map((trigger) => evaluateTrigger(result, pathway, trigger)),
		);
		if (evaluations.length === 0) {
			return null;
		}
		return evaluations.sort(
			(a, b) =>
				rank(RESULT_CLASSIFICATIONS, b.classification) - rank(RESULT_CLASSIFICATIONS, a.classification) ||
				rank(URGENCIES, b.urgency) - rank(URGENCIES, a.urgency) ||
				a.pathwayKey.localeCompare(b.pathwayKey),
		)[0];
	},
};

type Outcome = Pick<RuleEvaluation, 'classification' | 'urgency' | 'reason' | 'guideline' | 'nextState'> & {
	slaHours?: number;
};

function evaluateTrigger(
	result: RuleInput,
	pathway: PathwayDefinition,
	trigger: NumericTrigger | CodedTrigger,
): RuleEvaluation {
	const received = [result.value.trim(), result.unit?.trim()].filter(Boolean).join(' ');
	const matched = trigger.type === 'numeric' ? matchNumeric(result, trigger) : matchCoded(result, trigger);

	const base = {
		pathwayKey: pathway.key,
		pathwayVersion: pathway.version,
		rule: {
			code: trigger.code,
			display: trigger.display,
			band: null as string | null,
			comparedValue: null as number | null,
			comparedUnit: null as string | null,
			received,
		},
	};
	const flagged = result.flag != null && CRITICAL_FLAGS.has(result.flag);
	const flagText = result.flag === 'critical_low' ? 'critical low' : 'critical high';

	if ('problem' in matched) {
		// Never drop a result the pathway covers: it goes to a clinician's review queue, sooner if the lab flagged it.
		return finish(pathway, base, 'unrecognised', {
			classification: 'actionable',
			urgency: flagged ? 'urgent' : 'routine',
			reason: `${trigger.display}: ${matched.problem}; review by hand.${flagged ? ` The lab flagged it ${flagText}.` : ''}`,
			guideline: pathway.rules.source,
			nextState: flagged ? pathway.rules.criticalFlag.nextState : 'open',
			slaHours: flagged ? pathway.rules.criticalFlag.slaHours : pathway.slas.resultReviewHours,
		});
	}

	base.rule.band = matched.band;
	base.rule.comparedValue = matched.comparedValue;
	base.rule.comparedUnit = matched.comparedUnit;
	const { outcome } = matched;

	if (flagged && rank(URGENCIES, outcome.urgency) < rank(URGENCIES, 'urgent')) {
		return finish(pathway, base, 'critical_flag', {
			classification: atLeast(RESULT_CLASSIFICATIONS, outcome.classification, 'actionable'),
			urgency: 'urgent',
			reason: `The lab flagged this result ${flagText}; the pathway rule alone says: ${outcome.reason}`,
			guideline: outcome.guideline,
			nextState: pathway.rules.criticalFlag.nextState,
			slaHours: pathway.rules.criticalFlag.slaHours,
		});
	}
	return finish(pathway, base, 'band', outcome);
}

function finish(
	pathway: PathwayDefinition,
	base: Pick<RuleEvaluation, 'pathwayKey' | 'pathwayVersion' | 'rule'>,
	basis: EvaluationBasis,
	outcome: Outcome,
): RuleEvaluation {
	return {
		...base,
		basis,
		classification: outcome.classification,
		urgency: outcome.urgency,
		reason: outcome.reason,
		guideline: outcome.guideline,
		nextState: outcome.nextState,
		slaHours: outcome.slaHours ?? stepSlaHours(pathway, outcome.nextState) ?? null,
	};
}

type Match =
	{ outcome: Outcome; band: string; comparedValue: number | null; comparedUnit: string | null } | { problem: string };

/** A number as labs send it: "7.2", " 7.2 ", ">14" (above the assay range: compared as 14), "<4". */
export function parseNumericValue(value: string): number | null {
	const match = /^\s*(?:[<>]=?)?\s*(-?\d+(?:\.\d+)?|-?\.\d+)\s*$/.exec(value);
	return match ? Number(match[1]) : null;
}

/** The value in the trigger's canonical unit, or why it can't be converted. A missing unit is taken as canonical. */
export function toCanonicalUnit(
	value: number,
	unit: string | null | undefined,
	trigger: Pick<NumericTrigger, 'unit' | 'unitAliases' | 'conversions'>,
): { value: number; assumedUnit: boolean } | null {
	if (!unit?.trim()) {
		return { value, assumedUnit: true };
	}
	const given = normalizeUnit(unit);
	if ([trigger.unit, ...trigger.unitAliases].some((known) => normalizeUnit(known) === given)) {
		return { value, assumedUnit: false };
	}
	const conversion = trigger.conversions.find((c) => c.from.some((from) => normalizeUnit(from) === given));
	return conversion ? { value: clean(value * conversion.factor + conversion.offset), assumedUnit: false } : null;
}

function matchNumeric(result: RuleInput, trigger: NumericTrigger): Match {
	const raw =
		result.valueNumeric != null && Number.isFinite(result.valueNumeric)
			? result.valueNumeric
			: parseNumericValue(result.value);
	if (raw === null) {
		return { problem: `"${result.value}" is not a number` };
	}
	const converted = toCanonicalUnit(raw, result.unit, trigger);
	if (!converted) {
		return { problem: `unit "${result.unit}" is not one this rule knows (expects ${trigger.unit})` };
	}
	const { value } = converted;
	const band = trigger.bands.find(
		(candidate) =>
			(candidate.min === undefined || value >= candidate.min) &&
			(candidate.below === undefined || value < candidate.below),
	);
	// Contiguous bands from -∞ to +∞ (checked by the schema) always match; this guards a hand-built definition.
	if (!band) {
		return { problem: `${value} ${trigger.unit} falls in no band` };
	}
	const convertedNote =
		converted.assumedUnit || normalizeUnit(result.unit ?? '') === normalizeUnit(trigger.unit)
			? ''
			: ` (${raw} ${result.unit} = ${value} ${trigger.unit})`;
	const assumedNote = converted.assumedUnit ? ` (no unit sent; read as ${trigger.unit})` : '';
	return {
		outcome: { ...band, reason: `${band.reason}${convertedNote}${assumedNote}` },
		band: describeNumericBand(band, trigger.unit),
		comparedValue: value,
		comparedUnit: trigger.unit,
	};
}

/** The code inside a coded value: the pattern's first group, or the trimmed value. */
export function extractCode(value: string, valuePattern: string | undefined): string | null {
	const trimmed = value.trim();
	if (!valuePattern) {
		return trimmed || null;
	}
	const match = new RegExp(valuePattern, 'i').exec(trimmed);
	return match?.[1]?.toUpperCase() ?? null;
}

function matchCoded(result: RuleInput, trigger: CodedTrigger): Match {
	const code = extractCode(result.value, trigger.valuePattern);
	const band = code
		? trigger.bands.find((candidate) => candidate.values.some((v) => v.toUpperCase() === code))
		: null;
	if (!band) {
		return { problem: `"${result.value}" is not a value this rule knows` };
	}
	return {
		outcome: band,
		band: `${trigger.valueLabel ?? trigger.display} ${code}`,
		comparedValue: null,
		comparedUnit: null,
	};
}
