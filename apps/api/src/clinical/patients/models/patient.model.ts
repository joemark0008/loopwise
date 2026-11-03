import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

import { Sex } from '../../../generated/prisma/enums.js';

registerEnumType(Sex, { name: 'Sex' });

export enum DuplicateMatch {
	/** The MRN at this facility, or the PhilHealth number at any facility: never registered twice. */
	EXACT_IDENTIFIER = 'EXACT_IDENTIFIER',
	/** Same name, birth date and sex: possibly the same person; the clinician decides. */
	NAME_BIRTH_SEX = 'NAME_BIRTH_SEX',
}

registerEnumType(DuplicateMatch, { name: 'DuplicateMatch' });

@ObjectType({ description: 'A facility (organization) the user works at.' })
export class Facility {
	@Field(() => ID)
	id: string;

	@Field()
	name: string;

	@Field()
	slug: string;

	@Field(() => String, {
		nullable: true,
		description: '`clinic`, `lab`, `imaging`, `hospital`, `pharmacy` or `program`: picks the staff role on screen.',
	})
	type?: string | null;
}

@ObjectType()
export class PatientIdentifier {
	@Field({ description: '`MRN` or `PhilHealth`.' })
	system: string;

	@Field()
	value: string;

	/** Resolved by `PatientIdentifierResolver.facility`. */
	orgId: string;
}

@ObjectType({ description: 'A patient the signed-in user may see (row-level security).' })
export class Patient {
	@Field(() => ID)
	id: string;

	@Field()
	givenName: string;

	@Field()
	familyName: string;

	@Field({ description: 'YYYY-MM-DD.' })
	birthDate: string;

	@Field(() => Sex)
	sex: Sex;

	@Field(() => String, { nullable: true })
	phone: string | null;

	@Field()
	preferredLanguage: string;

	@Field(() => String, { nullable: true, description: 'Barangay of residence.' })
	barangay: string | null;

	@Field(() => Date, { nullable: true })
	consentAt: Date | null;

	@Field()
	createdAt: Date;

	@Field(() => [PatientIdentifier])
	identifiers: PatientIdentifier[];
}

@ObjectType({ description: 'An existing patient a registration may duplicate. Masked when the user cannot see them.' })
export class PatientDuplicate {
	@Field(() => ID)
	patientId: string;

	@Field(() => DuplicateMatch)
	match: DuplicateMatch;

	@Field({ description: 'Whether the user can already open this patient.' })
	visible: boolean;

	@Field({ description: 'What matched, e.g. `MRN THC-0001` or `name, birth date and sex`.' })
	matchedOn: string;

	@Field({ description: 'The full name when visible, else initials ("M. S.").' })
	displayName: string;

	@Field(() => Int)
	birthYear: number;

	@Field(() => [String], { description: 'Facilities the patient is registered at.' })
	facilityNames: string[];
}

@ObjectType()
export class RegisterPatientPayload {
	@Field(() => Patient, { nullable: true, description: 'The new patient; null when duplicates stopped it.' })
	patient: Patient | null;

	@Field(() => [PatientDuplicate])
	duplicates: PatientDuplicate[];
}
