import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'A project the user can access, with their role in it.' })
export class ProjectSummary {
	@Field(() => ID)
	id: string;

	@Field()
	name: string;

	@Field()
	type: string;

	@Field(() => String, {
		nullable: true,
		description: 'Folder holding the project context and `loopwise_config.yaml`.',
	})
	path: string | null;

	@Field(() => String, { nullable: true })
	orgId: string | null;

	@Field({ description: "The user's role: admin, user, viewer or context_admin." })
	userRole: string;

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

@ObjectType({ description: 'A synced warehouse table (upstream `project.getDatabaseObjects`).' })
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
