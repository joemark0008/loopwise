import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Sign-in methods available on the login page.' })
export class AuthProviders {
	@Field()
	google: boolean;

	@Field()
	github: boolean;

	@Field()
	gitlab: boolean;

	@Field({ description: 'Whether SMTP is configured (password reset and invitation emails).' })
	smtp: boolean;
}

@ObjectType()
export class PublicConfig {
	@Field({ description: 'Always "self-hosted": quarry has no cloud mode.' })
	quarryMode: string;

	@Field()
	enableUserLogin: boolean;

	@Field()
	emailVerificationEnabled: boolean;

	@Field()
	betaAutomationsEnabled: boolean;

	@Field()
	betaContextRecommendationsEnabled: boolean;

	@Field()
	betaStoryFiltersEnabled: boolean;

	@Field()
	betaSubagentsEnabled: boolean;

	@Field()
	betaCustomStoriesEnabled: boolean;

	@Field(() => AuthProviders)
	authProviders: AuthProviders;

	@Field()
	version: string;
}
