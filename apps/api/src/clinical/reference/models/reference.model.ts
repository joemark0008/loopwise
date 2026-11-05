import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'An ICD-10 code and its WHO title.' })
export class Icd10Code {
	@Field()
	code: string;

	@Field()
	title: string;
}

@ObjectType({ description: 'A barangay of the PSGC (Philippine Standard Geographic Code).' })
export class Barangay {
	@Field({ description: 'PSGC code.' })
	code: string;

	@Field()
	name: string;

	@Field({ description: 'PSGC code of its city or municipality.' })
	cityMunicipalityCode: string;
}
