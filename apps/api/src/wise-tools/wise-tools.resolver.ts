import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { uiToolset } from '../agent/tools/index.js';
import type { AuthUser } from '../auth/auth.service.js';
import { CurrentUser } from '../common/decorators/current.decorator.js';
import { WiseToolSettings } from './models/wise-tool-settings.model.js';
import { WiseToolSettingsService } from './wise-tool-settings.service.js';

/** The tools that exist; catalogue entries without one show as "Coming soon". Web tools come with the provider. */
const AVAILABLE_TOOLS: ReadonlySet<string> = new Set([...Object.keys(uiToolset), 'web_search', 'web_fetch']);

/** Settings → Wise tools (DESIGN.md §7.3). Organization switches are for its admins (checked in the service). */
@Resolver(() => WiseToolSettings)
export class WiseToolsResolver {
	constructor(private readonly settings: WiseToolSettingsService) {}

	@Query(() => WiseToolSettings, {
		description:
			"Every Wise tool with its state in one of the user's organizations (default: one they administer).",
	})
	wiseToolSettings(
		@CurrentUser() user: AuthUser,
		@Args('organizationId', { type: () => ID, nullable: true }) organizationId?: string | null,
	): Promise<WiseToolSettings> {
		return this.settings.view(user.id, organizationId ?? null, AVAILABLE_TOOLS);
	}

	@Mutation(() => Boolean, {
		description: "Turns a Wise tool on or off in an organization (the organization's admins only).",
	})
	async setWiseToolEnabled(
		@CurrentUser() user: AuthUser,
		@Args('organizationId', { type: () => ID }) organizationId: string,
		@Args('toolName') toolName: string,
		@Args('enabled') enabled: boolean,
	): Promise<boolean> {
		await this.settings.setOrganizationTool(user.id, organizationId, toolName, enabled);
		return true;
	}

	@Mutation(() => Boolean, {
		description: 'Turns a Wise tool off for yourself, or back on (as far as your organizations allow).',
	})
	async setMyWiseToolEnabled(
		@CurrentUser() user: AuthUser,
		@Args('toolName') toolName: string,
		@Args('enabled') enabled: boolean,
	): Promise<boolean> {
		await this.settings.setMyTool(user.id, toolName, enabled);
		return true;
	}
}
