import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

/** A Wise report version saved to a patient's chart, frozen with the results it embeds (DESIGN.md §7.2). */
@ObjectType()
export class ClinicalDocument {
	@Field(() => ID)
	id: string;

	@Field(() => ID)
	patientId: string;

	@Field()
	kind: string;

	@Field()
	title: string;

	@Field({ description: "The report's markdown with its <chart>/<table>/<sections> blocks." })
	body: string;

	@Field(() => GraphQLJSON, { description: 'The embedded tool results by result id, as saved.' })
	data: unknown;

	@Field(() => Int)
	version: number;

	@Field()
	sourceToolCallId: string;

	@Field()
	createdByName: string;

	@Field()
	createdAt: Date;
}
