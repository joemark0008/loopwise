import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'A clinic as the clinical screens name it: where a patient registers or a visit happens.' })
export class ClinicRef {
	@Field(() => ID)
	id: string;

	@Field()
	name: string;

	@Field({ description: 'Short code used in document numbers, e.g. "TAG".' })
	code: string;

	@Field(() => ID)
	organizationId: string;

	@Field(() => String, { nullable: true, description: 'PSGC code of its city or municipality.' })
	cityMunicipalityCode: string | null;
}
