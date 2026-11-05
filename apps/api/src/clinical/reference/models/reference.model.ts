import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'An ICD-10 code and its WHO title.' })
export class Icd10Code {
	@Field()
	code: string;

	@Field()
	title: string;
}

@ObjectType({ description: 'A city or municipality of the PSGC.' })
export class CityMunicipality {
	@Field({ description: 'PSGC code.' })
	code: string;

	@Field()
	name: string;

	@Field(() => String, { nullable: true, description: 'Its province (none for NCR cities and some HUCs).' })
	provinceName: string | null;

	@Field()
	isCity: boolean;

	@Field(() => String, { nullable: true })
	zipCode: string | null;
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
