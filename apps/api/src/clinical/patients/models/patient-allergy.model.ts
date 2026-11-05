import { Field, ID, ObjectType } from '@nestjs/graphql';

import type { PatientAllergy as PatientAllergyRow } from '../../../generated/prisma/client.js';
import { AllergyType, Severity } from '../patients.enums.js';

@ObjectType({ description: 'A known allergy of the patient.' })
export class PatientAllergy {
	@Field(() => ID)
	id: string;

	@Field(() => ID)
	patientId: string;

	@Field({ description: 'e.g. "Penicillin", "Shrimp".' })
	allergen: string;

	@Field(() => AllergyType)
	type: AllergyType;

	@Field(() => String, { nullable: true })
	reaction: string | null;

	@Field(() => Severity, { nullable: true })
	severity: Severity | null;

	@Field()
	notedAt: Date;

	@Field(() => Date, { nullable: true })
	voidedAt: Date | null;

	@Field(() => String, { nullable: true })
	voidReason: string | null;
}

export function toPatientAllergy(row: PatientAllergyRow): PatientAllergy {
	return {
		id: row.id,
		patientId: row.patientId,
		allergen: row.allergen,
		type: row.type,
		reaction: row.reaction,
		severity: row.severity,
		notedAt: row.notedAt,
		voidedAt: row.voidedAt,
		voidReason: row.voidReason,
	};
}
