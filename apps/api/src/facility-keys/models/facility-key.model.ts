import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType({
	description: "A facility's machine key for the HL7 / edge-connector ingest. The key itself is never shown again.",
})
export class FacilityKey {
	@Field(() => ID)
	id: string;

	@Field()
	name: string;

	@Field({ description: 'The first characters of the key, to tell keys apart.' })
	keyPrefix: string;

	@Field(() => Date, { nullable: true })
	lastUsedAt: Date | null;

	@Field()
	createdAt: Date;
}

@ObjectType({ description: 'A newly issued facility key.' })
export class CreatedFacilityKey {
	@Field({ description: 'Shown once: only a hash of it is stored.' })
	key: string;

	@Field(() => FacilityKey)
	facilityKey: FacilityKey;
}
