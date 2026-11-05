import { Field, ID, ObjectType } from '@nestjs/graphql';

import { StaffRole } from './clinic-enums.js';

@ObjectType({ description: 'A clinic the user can access, with their role in it.' })
export class ClinicSummary {
	@Field(() => ID)
	id: string;

	@Field()
	name: string;

	@Field({ description: 'Short code used in document numbers, unique in the organization (e.g. `TAG`).' })
	code: string;

	@Field({ description: 'Where the clinic context lives: `local` (a folder on the server).' })
	kind: string;

	@Field(() => String, {
		nullable: true,
		description: 'Folder holding the clinic context and `loopwise_config.yaml`.',
	})
	path: string | null;

	@Field(() => ID)
	organizationId: string;

	@Field({ description: "The user's access level, derived from their roles: admin, user, viewer or context_admin." })
	userRole: string;

	@Field(() => [StaffRole], {
		description:
			"The user's roles at the clinic (`user_clinic_roles`), e.g. DOCTOR or CASHIER: they pick the desks.",
	})
	staffRoles: StaffRole[];

	@Field()
	createdAt: Date;

	@Field()
	updatedAt: Date;
}

@ObjectType()
export class SavedPrompt {
	@Field(() => ID)
	id: string;

	@Field()
	title: string;

	@Field()
	prompt: string;

	@Field()
	createdAt: Date;

	@Field()
	updatedAt: Date;
}

@ObjectType({ description: 'A synced warehouse table (upstream `clinic.getDatabaseObjects`).' })
export class DatabaseObject {
	@Field()
	type: string;

	@Field()
	database: string;

	@Field()
	schema: string;

	@Field()
	table: string;

	@Field()
	fqdn: string;
}
