import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AppVersion {
	@Field()
	version: string;

	@Field()
	commit: string;

	@Field()
	buildDate: string;
}

@ObjectType()
export class UpdateCheck {
	@Field()
	currentVersion: string;

	@Field(() => String, { nullable: true })
	latestVersion: string | null;

	@Field()
	updateAvailable: boolean;
}
