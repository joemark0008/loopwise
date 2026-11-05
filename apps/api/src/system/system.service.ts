import { Injectable } from '@nestjs/common';

import { OrganizationsService } from '../clinical/clinics/organizations/organizations.service.js';
import { ConfigService } from '../config/config.service.js';
import type { PublicConfig } from './models/public-config.model.js';
import type { AppVersion } from './models/version.model.js';

/** Port of upstream trpc `system` (getPublicConfig, version) and `auth-config` (`*.isSetup`). */
@Injectable()
export class SystemService {
	constructor(
		private readonly config: ConfigService,
		private readonly organizations: OrganizationsService,
	) {}

	async getPublicConfig(): Promise<PublicConfig> {
		const { env } = this.config;
		const google = await this.organizations.getGoogleConfig();
		return {
			loopwiseMode: 'self-hosted',
			enableUserLogin: env.ENABLE_USER_LOGIN,
			emailVerificationEnabled: false,
			betaAutomationsEnabled: env.BETA_AUTOMATIONS_ENABLED,
			betaContextRecommendationsEnabled: env.BETA_CONTEXT_RECOMMENDATIONS_ENABLED,
			betaStoryFiltersEnabled: env.BETA_STORY_FILTERS_ENABLED,
			betaSubagentsEnabled: env.BETA_SUBAGENTS_ENABLED,
			betaCustomStoriesEnabled: env.BETA_CUSTOM_STORIES_ENABLED,
			authProviders: {
				google: !!(google.clientId && google.clientSecret),
				github: env.GITHUB_SSO && !!env.GITHUB_CLIENT_ID && !!env.GITHUB_CLIENT_SECRET,
				gitlab: env.GITLAB_SSO && !!env.GITLAB_CLIENT_ID && !!env.GITLAB_CLIENT_SECRET,
				smtp: !!(env.SMTP_HOST && env.SMTP_MAIL_FROM),
			},
			version: env.APP_VERSION,
		};
	}

	getVersion(): AppVersion {
		const { env } = this.config;
		return { version: env.APP_VERSION, commit: env.APP_COMMIT, buildDate: env.APP_BUILD_DATE };
	}
}
