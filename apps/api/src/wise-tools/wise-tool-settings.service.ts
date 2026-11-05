import {
	isWiseToolOnByDefault,
	WISE_TOOL_CATALOG,
	wiseToolEntry,
	wiseToolOffMessage,
} from '@loopwise/shared/wise-tools';
import { Injectable } from '@nestjs/common';

import { AuditService } from '../clinical/audit/audit.service.js';
import { ClinicalDbService } from '../clinical/rls/clinical-db.service.js';
import { HandlerError } from '../common/errors/handler-error.js';
import type { WiseToolSetting } from '../generated/prisma/client.js';
import { OrganizationsService, type UserOrganization } from '../organizations/organizations.service.js';
import { type WiseToolOwner, WiseToolSettingsRepository } from './wise-tool-settings.repository.js';

/** Settings → Wise tools; the GraphQL models (`models/wise-tool-settings.model.ts`) have the same shape. */
export interface WiseToolSettingsView {
	organizations: { id: string; name: string; isAdmin: boolean }[];
	organizationId: string | null;
	tools: {
		name: string;
		label: string;
		summary: string;
		kind: string;
		category: string;
		locked: boolean;
		comingSoon: boolean;
		organizationDefault: boolean;
		organizationEnabled: boolean;
		myEnabled: boolean;
		enabled: boolean;
	}[];
}

interface UserToolState {
	organizations: UserOrganization[];
	rows: WiseToolSetting[];
}

/**
 * Which Wise tools a user may use (DESIGN.md §7.3). A tool is on in an organization by its default unless the
 * organization's admin changed it; a user can turn a tool off for themselves, never on. Locked tools are always on.
 *
 * Enforced three times: the agent offers the model only the enabled tools (`disabledToolNames`), a tool call checks
 * again (`assertEnabled` in the tool guard), and Confirm checks the organization of the record (`WiseProposalService`).
 */
@Injectable()
export class WiseToolSettingsService {
	constructor(
		private readonly settings: WiseToolSettingsRepository,
		private readonly organizations: OrganizationsService,
		private readonly db: ClinicalDbService,
		private readonly audit: AuditService,
	) {}

	/** The names among `toolNames` that are off for the user: the agent leaves them out of the model's tool set. */
	async disabledToolNames(userId: string, toolNames: readonly string[]): Promise<string[]> {
		const state = await this.load(userId);
		return toolNames.filter((name) => !isEnabled(state, name));
	}

	/**
	 * Refuses a tool that is off for the user (FORBIDDEN, with the message Wise and the card show). With
	 * `organizationId`, the tool must be on in that organization: the one the record belongs to.
	 */
	async assertEnabled(userId: string, toolName: string, organizationId?: string): Promise<void> {
		const state = await this.load(userId);
		if (!isEnabled(state, toolName, organizationId)) {
			const entry = organizationId ? findOrganization(state, organizationId) : undefined;
			throw new HandlerError('FORBIDDEN', wiseToolOffMessage(toolName, entry?.organization.name));
		}
	}

	/**
	 * Settings → Wise tools: every catalogued tool with its state in `organizationId` (default: the first organization
	 * the user administers, else their first) and for the user. `available` are the tools that exist; others show
	 * "Coming soon".
	 */
	async view(
		userId: string,
		organizationId: string | null,
		available: ReadonlySet<string>,
	): Promise<WiseToolSettingsView> {
		const state = await this.load(userId);
		const selected =
			(organizationId ? findOrganization(state, organizationId) : undefined) ??
			state.organizations.find(({ isAdmin }) => isAdmin) ??
			state.organizations[0] ??
			null;
		return {
			organizations: state.organizations.map(({ organization: { id, name }, isAdmin }) => ({
				id,
				name,
				isAdmin,
			})),
			organizationId: selected?.organization.id ?? null,
			tools: WISE_TOOL_CATALOG.map((entry) => {
				const comingSoon = !!entry.comingSoon || !available.has(entry.name);
				const locked = !!entry.locked;
				return {
					name: entry.name,
					label: entry.label,
					summary: entry.summary,
					kind: entry.kind,
					category: entry.category,
					locked,
					comingSoon,
					organizationDefault: isWiseToolOnByDefault(entry.name),
					organizationEnabled:
						!comingSoon && (selected ? organizationOn(state, selected.organization.id, entry.name) : true),
					myEnabled: locked || userOptOut(state, entry.name) !== false,
					enabled: !comingSoon && isEnabled(state, entry.name),
				};
			}),
		};
	}

	/** An organization admin turns a tool on or off there; setting it to the default removes the override. */
	async setOrganizationTool(
		userId: string,
		organizationId: string,
		toolName: string,
		enabled: boolean,
	): Promise<void> {
		const entry = assertSwitchable(toolName);
		const organization = findOrganization(await this.load(userId), organizationId);
		if (!organization?.isAdmin) {
			throw new HandlerError('FORBIDDEN', "Only the organization's admins can change its Wise tools.");
		}
		const isDefault = enabled === isWiseToolOnByDefault(entry.name);
		await this.change({ organizationId }, toolName, isDefault ? null : enabled, userId);
	}

	/** A user turns a tool off for themselves, or back on (to what their organizations allow). */
	async setMyTool(userId: string, toolName: string, enabled: boolean): Promise<void> {
		assertSwitchable(toolName);
		await this.change({ userId }, toolName, enabled ? null : false, userId);
	}

	/**
	 * Writes the override (null removes it) and its audit row (`wise_tool.enable` / `.disable` / `.reset`) in one
	 * transaction. System work: settings are not clinical rows, and the service has checked who may change them.
	 */
	private change(owner: WiseToolOwner, toolName: string, enabled: boolean | null, userId: string): Promise<void> {
		const organizationId = 'organizationId' in owner ? owner.organizationId : null;
		return this.db.asSystem(async (tx) => {
			await this.settings.set(tx, owner, toolName, enabled, userId);
			await this.audit.updated(tx, {
				event: enabled === null ? 'wise_tool.reset' : enabled ? 'wise_tool.enable' : 'wise_tool.disable',
				entityType: 'WiseToolSetting',
				entityId: toolName,
				userId,
				organizationId,
				changes: { after: { toolName, enabled } },
				reason: organizationId ? 'organization setting' : 'own setting',
			});
		});
	}

	private async load(userId: string): Promise<UserToolState> {
		const organizations = await this.organizations.listUserOrganizations(userId);
		const rows = await this.settings.listFor(
			organizations.map(({ organization }) => organization.id),
			userId,
		);
		return { organizations, rows };
	}
}

function findOrganization(state: UserToolState, organizationId: string): UserOrganization | undefined {
	return state.organizations.find(({ organization }) => organization.id === organizationId);
}

function assertSwitchable(toolName: string) {
	const entry = wiseToolEntry(toolName);
	if (!entry) {
		throw new HandlerError('NOT_FOUND', `There is no Wise tool called ${toolName}.`);
	}
	if (entry.locked || entry.comingSoon) {
		throw new HandlerError('BAD_REQUEST', `${entry.label} can't be turned on or off.`);
	}
	return entry;
}

function userOptOut(state: UserToolState, toolName: string): boolean | undefined {
	return state.rows.find((row) => row.userId && row.toolName === toolName)?.enabled;
}

function organizationOn(state: UserToolState, organizationId: string, toolName: string): boolean {
	const override = state.rows.find((row) => row.organizationId === organizationId && row.toolName === toolName);
	return override?.enabled ?? isWiseToolOnByDefault(toolName);
}

/**
 * Locked tools are on; a tool the user turned off is off; otherwise it is on when the organization of the record has
 * it on, or, without one, when any of the user's organizations does. A tool missing from the catalogue (an MCP or
 * profile tool) isn't governed here; the registry spec keeps every built-in tool in the catalogue.
 */
function isEnabled(state: UserToolState, toolName: string, organizationId?: string): boolean {
	const entry = wiseToolEntry(toolName);
	if (!entry || entry.locked) {
		return true;
	}
	if (entry.comingSoon || userOptOut(state, toolName) === false) {
		return false;
	}
	const record = organizationId ? findOrganization(state, organizationId) : undefined;
	if (record) {
		return organizationOn(state, record.organization.id, toolName);
	}
	if (state.organizations.length === 0) {
		return isWiseToolOnByDefault(toolName);
	}
	return state.organizations.some(({ organization }) => organizationOn(state, organization.id, toolName));
}
