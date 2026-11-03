import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'What prescriptions and certificates print about a clinician.' })
export class ClinicianProfile {
	@Field(() => String, { nullable: true })
	credentials: string | null;

	@Field(() => String, { nullable: true })
	specialty: string | null;

	@Field(() => String, { nullable: true })
	prcLicenseNumber: string | null;

	@Field(() => String, { nullable: true })
	ptrNumber: string | null;
}
