import z from 'zod/v3';

/**
 * The clinical pathway definition (DESIGN.md §2 "rules-first decisions", §7 `Pathway`, §8 states): which results a
 * pathway applies to, how a value is classified, which case states apply, their SLAs and what closing needs. Stored in
 * the `pathway` row's JSON columns, validated on load by the API and by the seed. One schema for the API, the seed, the
 * rules engine and the read-only pathways page. Deterministic data, no AI.
 */

/** Bumped when the shape below changes; a stored definition with another version is refused. */
export const PATHWAY_SCHEMA_VERSION = 2;

export const RESULT_CLASSIFICATIONS = ['normal', 'actionable', 'critical'] as const;
export type ResultClassification = (typeof RESULT_CLASSIFICATIONS)[number];

/** Same order as the Postgres `urgency` enum, least to most urgent. */
export const URGENCIES = ['routine', 'soon', 'urgent', 'critical'] as const;
export type Urgency = (typeof URGENCIES)[number];

/** The Postgres `case_state` enum (DESIGN.md §8). */
export const CASE_STATES = [
	'open',
	'notified',
	'acknowledged',
	'confirming',
	'referred',
	'accepted',
	'seen',
	'treatment_started',
	'closed',
	'escalated',
	'lost_to_follow_up',
] as const;
export type CaseState = (typeof CASE_STATES)[number];

/** States any case can enter from any step (§8); a pathway doesn't list them among its steps. */
export const ANY_STEP_STATES: readonly CaseState[] = ['escalated', 'lost_to_follow_up'];

/** The Postgres `evidence_type` enum. */
export const EVIDENCE_TYPES = ['result', 'visit_note', 'dispense', 'signoff'] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

/** The Postgres `result_flag` enum: the flag the lab sent (HL7 OBX-8). */
export const RESULT_FLAGS = ['normal', 'low', 'high', 'abnormal', 'critical_low', 'critical_high'] as const;
export type ResultFlag = (typeof RESULT_FLAGS)[number];

/** What a band concludes: the classification, the urgency, why, and the case state the case engine should aim for. */
const OutcomeSchema = z.object({
	classification: z.enum(RESULT_CLASSIFICATIONS),
	urgency: z.enum(URGENCIES),
	/** Plain-language reason, shown to the clinician as is ("HbA1c in the diabetes range"). */
	reason: z.string().min(1),
	/** The guideline the threshold comes from. */
	guideline: z.string().min(1),
	/** The next case state (§8): one of the pathway's steps, or `escalated`. */
	nextState: z.enum(CASE_STATES),
	/** Overrides the SLA of `nextState`'s step, e.g. a shorter one for an urgent band. */
	slaHours: z.number().positive().optional(),
});

/** A numeric band: `min <= value < below`. A missing bound is open. */
const NumericBandSchema = OutcomeSchema.extend({
	min: z.number().optional(),
	below: z.number().optional(),
});

/** A coded band: matches when the value's extracted code is one of `values` (e.g. BI-RADS categories). */
const CodedBandSchema = OutcomeSchema.extend({
	values: z.array(z.string().min(1)).min(1),
});

/** value in `from` → value × factor + offset in the trigger's canonical unit. */
const UnitConversionSchema = z.object({
	from: z.array(z.string().min(1)).min(1),
	factor: z.number().positive(),
	offset: z.number().default(0),
	/** The source of the formula, shown on the pathways page. */
	note: z.string().optional(),
});

const TriggerBaseSchema = z.object({
	/** Result code (LOINC by default). */
	code: z.string().min(1),
	codeSystem: z.string().default('LOINC'),
	display: z.string().min(1),
});

const NumericTriggerSchema = TriggerBaseSchema.extend({
	type: z.literal('numeric'),
	/** The unit the bands are written in. */
	unit: z.string().min(1),
	/** Other spellings of the canonical unit (factor 1). */
	unitAliases: z.array(z.string()).default([]),
	conversions: z.array(UnitConversionSchema).default([]),
	/** Bands in ascending order, contiguous, from no lower bound to no upper bound: every value lands in exactly one. */
	bands: z.array(NumericBandSchema).min(1),
});

const CodedTriggerSchema = TriggerBaseSchema.extend({
	type: z.literal('coded'),
	/**
	 * Case-insensitive regular expression whose first group is the code, so free text ("BI-RADS 4", "Category 4A")
	 * and bare codes ("4") both match. Without it the trimmed value is the code.
	 */
	valuePattern: z.string().optional(),
	/** Shown before the code in explanations: "BI-RADS" → "BI-RADS 4". */
	valueLabel: z.string().optional(),
	bands: z.array(CodedBandSchema).min(1),
});

export const PathwayTriggerSchema = z.discriminatedUnion('type', [NumericTriggerSchema, CodedTriggerSchema]);

export const PathwayRulesSchema = z.object({
	schemaVersion: z.literal(PATHWAY_SCHEMA_VERSION),
	/** The guidelines the pathway follows, in one line. */
	source: z.string().min(1),
	triggers: z.array(PathwayTriggerSchema).min(1),
	/**
	 * A lab's critical flag (`critical_low` / `critical_high`) always makes a result at least actionable and urgent;
	 * when the band was less than that, the case goes here.
	 */
	criticalFlag: z.object({ nextState: z.enum(CASE_STATES), slaHours: z.number().positive() }),
});

export const PathwayStepSchema = z.object({
	state: z.enum(CASE_STATES),
	/** What happens in this step, and who owns it. */
	label: z.string().min(1),
	/** Hours the case may stay in this state before it escalates; none for `closed`. */
	slaHours: z.number().positive().optional(),
});

export const PathwayStepsSchema = z.array(PathwayStepSchema).min(1);

/** Pathway-wide SLAs, not tied to one step (DESIGN.md §4.2). */
export const PathwaySlasSchema = z.object({
	/** A result must be reviewed within this many hours, or it escalates to the clinic head. */
	resultReviewHours: z.number().positive(),
	/** A critical value must reach a clinician within this many hours. */
	criticalAlertHours: z.number().positive(),
});

export const PathwayClosureSchema = z.object({
	/** Closing needs one of these `Evidence` types (DESIGN.md §8). */
	anyOf: z.array(z.enum(EVIDENCE_TYPES)).min(1),
	/** A sign-off must name the clinician and give a reason. */
	signoffNeedsReason: z.boolean(),
	description: z.string().min(1),
});

/** A pathway as stored: the row's columns. */
export const PathwayDefinitionSchema = z
	.object({
		key: z.string().regex(/^[a-z][a-z0-9_-]*$/),
		name: z.string().min(1),
		version: z.number().int().positive(),
		rules: PathwayRulesSchema,
		steps: PathwayStepsSchema,
		slas: PathwaySlasSchema,
		closureRequirements: PathwayClosureSchema,
	})
	.superRefine((pathway, ctx) => {
		for (const issue of pathwayIssues(pathway)) {
			ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue.message, path: issue.path });
		}
	});

export type PathwayDefinition = z.infer<typeof PathwayDefinitionSchema>;
export type PathwayDefinitionInput = z.input<typeof PathwayDefinitionSchema>;
export type PathwayTrigger = z.infer<typeof PathwayTriggerSchema>;
export type NumericTrigger = z.infer<typeof NumericTriggerSchema>;
export type CodedTrigger = z.infer<typeof CodedTriggerSchema>;
export type NumericBand = z.infer<typeof NumericBandSchema>;
export type CodedBand = z.infer<typeof CodedBandSchema>;
export type PathwayStep = z.infer<typeof PathwayStepSchema>;

type Issue = { message: string; path: (string | number)[] };

/** The checks a shape can't express: bands that cover every value once, states the pathway has, valid patterns. */
function pathwayIssues(pathway: Omit<PathwayDefinition, never>): Issue[] {
	const issues: Issue[] = [];
	const states = pathway.steps.map((step) => step.state);
	const reachable = new Set<CaseState>([...states, ...ANY_STEP_STATES]);

	states.forEach((state, index) => {
		if (states.indexOf(state) !== index) {
			issues.push({ message: `Step "${state}" is listed twice.`, path: ['steps', index, 'state'] });
		}
		if (ANY_STEP_STATES.includes(state)) {
			issues.push({
				message: `"${state}" applies to every pathway; don't list it as a step.`,
				path: ['steps', index, 'state'],
			});
		}
	});
	if (states[0] !== 'open') {
		issues.push({ message: 'The first step must be "open".', path: ['steps', 0, 'state'] });
	}
	if (states[states.length - 1] !== 'closed') {
		issues.push({ message: 'The last step must be "closed".', path: ['steps', states.length - 1, 'state'] });
	}
	if (!reachable.has(pathway.rules.criticalFlag.nextState)) {
		issues.push({
			message: `criticalFlag.nextState "${pathway.rules.criticalFlag.nextState}" is not a step of this pathway.`,
			path: ['rules', 'criticalFlag', 'nextState'],
		});
	}

	const codes = new Set<string>();
	pathway.rules.triggers.forEach((trigger, t) => {
		const at = (...rest: (string | number)[]) => ['rules', 'triggers', t, ...rest];
		const key = `${trigger.codeSystem}|${trigger.code}`;
		if (codes.has(key)) {
			issues.push({ message: `Code ${trigger.code} has two triggers.`, path: at('code') });
		}
		codes.add(key);

		trigger.bands.forEach((band, b) => {
			if (!reachable.has(band.nextState)) {
				issues.push({
					message: `Band ${b + 1} of ${trigger.code}: nextState "${band.nextState}" is not a step of this pathway.`,
					path: at('bands', b, 'nextState'),
				});
			}
			if (band.classification === 'critical' && band.urgency !== 'critical') {
				issues.push({
					message: `Band ${b + 1} of ${trigger.code}: a critical classification needs critical urgency.`,
					path: at('bands', b, 'urgency'),
				});
			}
			if (band.classification === 'normal' && band.urgency !== 'routine') {
				issues.push({
					message: `Band ${b + 1} of ${trigger.code}: a normal result is routine.`,
					path: at('bands', b, 'urgency'),
				});
			}
		});

		if (trigger.type === 'numeric') {
			issues.push(...numericBandIssues(trigger).map((issue) => ({ ...issue, path: at(...issue.path) })));
			const units = [trigger.unit, ...trigger.unitAliases, ...trigger.conversions.flatMap((c) => c.from)].map(
				normalizeUnit,
			);
			if (new Set(units).size !== units.length) {
				issues.push({ message: `${trigger.code}: a unit is listed twice.`, path: at('conversions') });
			}
		} else {
			if (trigger.valuePattern !== undefined) {
				try {
					new RegExp(trigger.valuePattern, 'i');
				} catch {
					issues.push({
						message: `${trigger.code}: valuePattern is not a valid pattern.`,
						path: at('valuePattern'),
					});
				}
			}
			const seen = new Set<string>();
			trigger.bands.forEach((band, b) =>
				band.values.forEach((value) => {
					const code = value.toUpperCase();
					if (seen.has(code)) {
						issues.push({
							message: `${trigger.code}: value "${value}" is in two bands.`,
							path: at('bands', b),
						});
					}
					seen.add(code);
				}),
			);
		}
	});
	return issues;
}

function numericBandIssues(trigger: NumericTrigger): Issue[] {
	const issues: Issue[] = [];
	const { bands } = trigger;
	if (bands[0].min !== undefined) {
		issues.push({
			message: `${trigger.code}: the first band must have no lower bound.`,
			path: ['bands', 0, 'min'],
		});
	}
	if (bands[bands.length - 1].below !== undefined) {
		issues.push({
			message: `${trigger.code}: the last band must have no upper bound.`,
			path: ['bands', bands.length - 1, 'below'],
		});
	}
	bands.forEach((band, b) => {
		if (band.min !== undefined && band.below !== undefined && band.min >= band.below) {
			issues.push({ message: `${trigger.code}: band ${b + 1} is empty.`, path: ['bands', b] });
		}
		if (b > 0) {
			const previous = bands[b - 1];
			if (previous.below === undefined || band.min === undefined || previous.below !== band.min) {
				issues.push({
					message: `${trigger.code}: band ${b + 1} must start where band ${b} ends.`,
					path: ['bands', b, 'min'],
				});
			}
		}
	});
	return issues;
}

/** Units compare case- and space-insensitively ("mg/dL" = "mg/dl", "mmol / L" = "mmol/l"). */
export function normalizeUnit(unit: string): string {
	return unit.replace(/\s+/g, '').toLowerCase();
}

/** Parses a stored pathway row; throws with every problem listed when it doesn't follow the schema. */
export function parsePathwayDefinition(row: unknown): PathwayDefinition {
	const parsed = PathwayDefinitionSchema.safeParse(row);
	if (!parsed.success) {
		const key = (row as { key?: unknown } | null)?.key;
		const problems = parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
		throw new Error(`Pathway ${typeof key === 'string' ? key : '(unknown)'} is invalid:\n${problems.join('\n')}`);
	}
	return parsed.data;
}

/** Hours before a case in `state` escalates, for this pathway. */
export function stepSlaHours(pathway: PathwayDefinition, state: CaseState): number | undefined {
	if (state === 'escalated') {
		return pathway.slas.criticalAlertHours;
	}
	return pathway.steps.find((step) => step.state === state)?.slaHours;
}

/** "5.7 ≤ x < 6.5", "x < 5.7", "x ≥ 12": a band's range for people. */
export function describeNumericBand(band: Pick<NumericBand, 'min' | 'below'>, unit: string): string {
	if (band.min === undefined && band.below === undefined) {
		return 'any value';
	}
	if (band.min === undefined) {
		return `< ${band.below} ${unit}`;
	}
	if (band.below === undefined) {
		return `≥ ${band.min} ${unit}`;
	}
	return `${band.min} – < ${band.below} ${unit}`;
}
