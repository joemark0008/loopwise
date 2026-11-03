import { Field, Float, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

import { CaseState, EvidenceType, ResultClassification, Urgency } from '../../../generated/prisma/enums.js';

registerEnumType(ResultClassification, { name: 'ResultClassification' });
registerEnumType(Urgency, { name: 'Urgency' });
registerEnumType(CaseState, { name: 'CaseState' });
registerEnumType(EvidenceType, { name: 'EvidenceType' });

/** One threshold or code list of a trigger and what it concludes (`@quarry/shared/pathway-rules`). */
@ObjectType()
export class PathwayBand {
	@Field({ description: 'The range ("6.5 – < 10 %") or the codes ("BI-RADS 4") the band covers.' })
	label: string;

	@Field(() => Float, { nullable: true, description: 'Lower bound, inclusive (numeric bands).' })
	min: number | null;

	@Field(() => Float, { nullable: true, description: 'Upper bound, exclusive (numeric bands).' })
	below: number | null;

	@Field(() => [String], { nullable: true, description: 'The codes of a coded band.' })
	values: string[] | null;

	@Field(() => ResultClassification)
	classification: ResultClassification;

	@Field(() => Urgency)
	urgency: Urgency;

	@Field()
	reason: string;

	@Field()
	guideline: string;

	@Field(() => CaseState)
	nextState: CaseState;

	@Field(() => Float, {
		nullable: true,
		description: "Hours allowed in the next state: the band's own or the step's.",
	})
	slaHours: number | null;
}

@ObjectType()
export class PathwayUnitConversion {
	@Field(() => [String])
	from: string[];

	@Field(() => Float)
	factor: number;

	@Field(() => Float)
	offset: number;

	@Field(() => String, { nullable: true })
	note: string | null;
}

/** A result code the pathway applies to. */
@ObjectType()
export class PathwayTrigger {
	@Field()
	code: string;

	@Field()
	codeSystem: string;

	@Field()
	display: string;

	@Field({ description: '`numeric` (thresholds) or `coded` (code lists, e.g. BI-RADS).' })
	type: string;

	@Field(() => String, { nullable: true, description: 'The unit numeric bands are written in.' })
	unit: string | null;

	@Field(() => [PathwayUnitConversion])
	conversions: PathwayUnitConversion[];

	@Field(() => [PathwayBand])
	bands: PathwayBand[];
}

@ObjectType()
export class PathwayStep {
	@Field(() => CaseState)
	state: CaseState;

	@Field()
	label: string;

	@Field(() => Float, { nullable: true })
	slaHours: number | null;
}

/** A clinical pathway and its rules, read-only (DESIGN.md §7, §8). */
@ObjectType()
export class Pathway {
	@Field()
	key: string;

	@Field()
	name: string;

	@Field(() => Int)
	version: number;

	@Field({ description: 'The guidelines the pathway follows.' })
	source: string;

	@Field(() => [PathwayTrigger])
	triggers: PathwayTrigger[];

	@Field(() => [PathwayStep])
	steps: PathwayStep[];

	@Field(() => Float, { description: 'A result must be reviewed within this many hours.' })
	resultReviewHours: number;

	@Field(() => Float, { description: 'A critical value must reach a clinician within this many hours.' })
	criticalAlertHours: number;

	@Field(() => CaseState, {
		description: 'Where a result the lab flagged critical goes when its band is less urgent.',
	})
	criticalFlagNextState: CaseState;

	@Field(() => [EvidenceType], { description: 'Closing needs one of these.' })
	closureEvidence: EvidenceType[];

	@Field()
	closureDescription: string;
}
