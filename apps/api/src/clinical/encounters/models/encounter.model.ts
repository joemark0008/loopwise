import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'A visit of a patient at a facility (DESIGN.md §5).' })
export class Encounter {
	@Field(() => ID)
	id: string;

	@Field(() => ID)
	patientId: string;

	@Field(() => String, { nullable: true, description: 'The chief complaint.' })
	reason: string | null;

	@Field(() => String, { nullable: true })
	notes: string | null;

	@Field(() => String, { nullable: true, description: 'History of present illness (subjective).' })
	history: string | null;

	@Field(() => String, { nullable: true, description: 'Physical examination findings (objective).' })
	physicalExam: string | null;

	@Field(() => String, { nullable: true })
	assessment: string | null;

	@Field(() => String, { nullable: true })
	plan: string | null;

	@Field(() => String, { nullable: true })
	patientInstructions: string | null;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD.' })
	followUpOn: string | null;

	@Field()
	startedAt: Date;

	@Field(() => ID, { nullable: true, description: 'The chart chat Wise drafted it in, if any.' })
	sourceChatId: string | null;

	@Field(() => Int, {
		description: 'Moves on every change; pass it back as `expectedVersion` to refuse a stale edit.',
	})
	version: number;

	/** Resolved by `EncounterResolver.facility` / `.doctor`. */
	orgId: string;
	doctorId: string;
}

@ObjectType()
export class EncounterDoctor {
	@Field(() => ID)
	id: string;

	@Field()
	name: string;
}
