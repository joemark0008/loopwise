import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'A facility whose Wise tools the user sees, and whether they administer it.' })
export class WiseToolFacility {
	@Field(() => ID)
	id: string;

	@Field()
	name: string;

	@Field({ description: 'The facility type (clinic, lab, …), which sets the defaults.' })
	type: string;

	@Field()
	isAdmin: boolean;
}

@ObjectType({ description: 'One Wise tool in Settings → Wise tools (DESIGN.md §9.4).' })
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

	@Field({ description: "The facility type's default at the selected facility." })
	facilityDefault: boolean;

	@Field({ description: 'On at the selected facility (its override, else the default).' })
	facilityEnabled: boolean;

	@Field({ description: 'False when the user turned it off for themselves.' })
	myEnabled: boolean;

	@Field({ description: 'Whether Wise offers it to the user now.' })
	enabled: boolean;
}

@ObjectType()
export class WiseToolSettings {
	@Field(() => [WiseToolFacility])
	facilities: WiseToolFacility[];

	@Field(() => ID, { nullable: true, description: 'The facility the `facility*` fields are about.' })
	facilityId: string | null;

	@Field(() => [WiseToolView])
	tools: WiseToolView[];
}
