import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'An organization whose Wise tools the user sees, and whether they administer it.' })
export class WiseToolOrganization {
	@Field(() => ID)
	id: string;

	@Field()
	name: string;

	@Field()
	isAdmin: boolean;
}

@ObjectType({ description: 'One Wise tool in Settings → Wise tools (DESIGN.md §7.3).' })
export class WiseToolView {
	@Field()
	name: string;

	@Field()
	label: string;

	@Field()
	summary: string;

	@Field({ description: 'read, navigate, display or propose.' })
	kind: string;

	@Field()
	category: string;

	@Field({ description: 'Always on; no switch.' })
	locked: boolean;

	@Field({ description: 'Not a tool yet; no switch.' })
	comingSoon: boolean;

	@Field({ description: 'The default in an organization, before its admin changes it.' })
	organizationDefault: boolean;

	@Field({ description: 'On in the selected organization (its override, else the default).' })
	organizationEnabled: boolean;

	@Field({ description: 'False when the user turned it off for themselves.' })
	myEnabled: boolean;

	@Field({ description: 'Whether Wise offers it to the user now.' })
	enabled: boolean;
}

@ObjectType()
export class WiseToolSettings {
	@Field(() => [WiseToolOrganization])
	organizations: WiseToolOrganization[];

	@Field(() => ID, { nullable: true, description: 'The organization the `organization*` fields are about.' })
	organizationId: string | null;

	@Field(() => [WiseToolView])
	tools: WiseToolView[];
}
