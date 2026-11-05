import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

import { CaseState, ResultClassification, Urgency } from '../../../generated/prisma/enums.js';

/** The rule that fired (`RuleEvaluation['rule']`). */
@ObjectType()
export class EvaluatedRule {
	@Field()
	code: string;

	@Field()
	display: string;

	@Field(() => String, {
		nullable: true,
		description: "The band's range or codes; null when the value was not recognised.",
	})
	band: string | null;

	@Field(() => Float, { nullable: true, description: "The value in the band's unit, after conversion." })
	comparedValue: number | null;

	@Field(() => String, { nullable: true })
	comparedUnit: string | null;

	@Field({ description: 'The value as received, with its unit.' })
	received: string;
}

/** Why a result is normal, actionable or critical: the deterministic rules engine's evaluation (DESIGN.md §4.2). */
@ObjectType()
export class ResultEvaluation {
	@Field(() => ID)
	id: string;

	@Field(() => ID)
	resultId: string;

	@Field()
	pathwayKey: string;

	@Field()
	pathwayName: string;

	@Field(() => Int, { description: 'The pathway version the rule came from.' })
	ruleVersion: number;

	@Field(() => ResultClassification)
	classification: ResultClassification;

	@Field(() => Urgency)
	urgency: Urgency;

	@Field()
	reason: string;

	@Field()
	guideline: string;

	@Field(() => CaseState, { description: 'The case state the case engine should aim for.' })
	nextState: CaseState;

	@Field(() => Float, { nullable: true })
	slaHours: number | null;

	@Field({ description: '`band`, `critical_flag` (the lab flag raised it) or `unrecognised` (review by hand).' })
	basis: string;

	@Field(() => EvaluatedRule)
	rule: EvaluatedRule;

	@Field()
	evaluatedAt: Date;
}
