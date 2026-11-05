import {
	type FacilityType,
	isWiseToolOnByDefault,
	WISE_TOOL_CATALOG,
	wiseToolEntry,
	wiseToolOffMessage,
} from '@loopwise/shared/wise-tools';
import { Injectable } from '@nestjs/common';

import { HandlerError } from '../common/errors/handler-error.js';
import type { Organization, WiseToolSetting } from '../generated/prisma/client.js';
import { OrganizationRepository } from '../organizations/organization.repository.js';
import { WiseToolSettingsRepository } from './wise-tool-settings.repository.js';

/** A user without a facility (a workspace admin, a test user) keeps the clinic defaults: Wise works as it always did. */
const NO_FACILITY_TYPE: FacilityType = 'clinic';

/** Settings → Wise tools; the GraphQL models (`models/wise-tool-settings.model.ts`) have the same shape. */
export interface WiseToolSettingsView {
	facilities: { id: string; name: string; type: string; isAdmin: boolean }[];
	facilityId: string | null;
	tools: {
		name: string;
		label: string;
		summary: string;
		kind: string;
		category: string;
		locked: boolean;
		comingSoon: boolean;
		facilityDefault: boolean;
		facilityEnabled: boolean;
		myEnabled: boolean;
		enabled: boolean;
	}[];
}

interface UserToolState {
	facilities: Organization[];
	rows: WiseToolSetting[];
}

/**
 * Which Wise tools a user may use (DESIGN.md §7.3). A tool is on for a facility by its type's default unless the
 * facility's admin changed it; a user can turn a tool off for themselves, never on. Locked tools are always on.
 *
 * Enforced three times: the agent offers the model only the enabled tools (`disabledToolNames`), a tool call checks
 * again (`assertEnabled` in the tool guard), and Confirm checks the facility of the record (`WiseProposalService`).
 */
@Injectable()
export class WiseToolSettingsService {
	constructor(
		private readonly settings: WiseToolSettingsRepository,
		private readonly organizations: OrganizationRepository,
	) {}

	/** The names among `toolNames` that are off for the user: the agent leaves them out of the model's tool set. */
	async disabledToolNames(userId: string, toolNames: readonly string[]): Promise<string[]> {
		const state = await this.load(userId);
		return toolNames.filter((name) => !isEnabled(state, name));
	}

	/**
	 * Refuses a tool that is off for the user (FORBIDDEN, with the message Wise and the card show). With `facilityId`,
	 * the tool must be on at that facility: the one the record belongs to.
	 */
	async assertEnabled(userId: string, toolName: string, facilityId?: string): Promise<void> {
		const state = await this.load(userId);
		if (!isEnabled(state, toolName, facilityId)) {
			const facility = facilityId ? state.facilities.find((candidate) => candidate.id === facilityId) : undefined;
			throw new HandlerError('FORBIDDEN', wiseToolOffMessage(toolName, facility?.name));
		}
	}

	/**
	 * Settings → Wise tools: every catalogued tool with its state at `facilityId` (default: the first facility the user
	 * administers, else their first) and for the user. `available` are the tools that exist; others show "Coming soon".
	 */
	async view(
		userId: string,
		facilityId: string | null,
		available: ReadonlySet<string>,
	): Promise<WiseToolSettingsView> {
		const state = await this.load(userId);
		const adminOf = new Set<string>();
		for (const facility of state.facilities) {
			if (await this.settings.isOrgAdmin(userId, facility.id)) {
				adminOf.add(facility.id);
			}
		}
		const selected =
			state.facilities.find((facility) => facility.id === facilityId) ??
			state.facilities.find((facility) => adminOf.has(facility.id)) ??
			state.facilities[0] ??
			null;
		return {
			facilities: state.facilities.map(({ id, name, type }) => ({ id, name, type, isAdmin: adminOf.has(id) })),
			facilityId: selected?.id ?? null,
			tools: WISE_TOOL_CATALOG.map((entry) => {
				const comingSoon = !!entry.comingSoon || !available.has(entry.name);
				const locked = !!entry.locked;
				const type = (selected?.type ?? NO_FACILITY_TYPE) as FacilityType;
				return {
					name: entry.name,
					label: entry.label,
					summary: entry.summary,
					kind: entry.kind,
					category: entry.category,
					locked,
					comingSoon,
					facilityDefault: isWiseToolOnByDefault(entry.name, type),
					facilityEnabled: !comingSoon && (selected ? facilityOn(state, selected, entry.name) : true),
					myEnabled: locked || userOptOut(state, entry.name) !== false,
					enabled: !comingSoon && isEnabled(state, entry.name),
				};
			}),
		};
	}

	/** A facility admin turns a tool on or off at their facility; setting it to the type's default removes the override. */
	async setFacilityTool(userId: string, facilityId: string, toolName: string, enabled: boolean): Promise<void> {
		const entry = assertSwitchable(toolName);
		const facility = (await this.organizations.getUserFacilities(userId)).find(({ id }) => id === facilityId);
		if (!facility || !(await this.settings.isOrgAdmin(userId, facilityId))) {
			throw new HandlerError('FORBIDDEN', "Only the facility's admins can change its Wise tools.");
		}
		const isDefault = enabled === isWiseToolOnByDefault(entry.name, facility.type as FacilityType);
		await this.settings.set({ orgId: facilityId }, toolName, isDefault ? null : enabled, userId);
	}

	/** A user turns a tool off for themselves, or back on (to what their facilities allow). */
	async setMyTool(userId: string, toolName: string, enabled: boolean): Promise<void> {
		assertSwitchable(toolName);
		await this.settings.set({ userId }, toolName, enabled ? null : false, userId);
	}

	private async load(userId: string): Promise<UserToolState> {
		const facilities = await this.organizations.getUserFacilities(userId);
		const rows = await this.settings.listFor(
			facilities.map((facility) => facility.id),
			userId,
		);
		return { facilities, rows };
	}
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

function facilityOn(state: UserToolState, facility: Organization, toolName: string): boolean {
	const override = state.rows.find((row) => row.orgId === facility.id && row.toolName === toolName);
	return override?.enabled ?? isWiseToolOnByDefault(toolName, facility.type as FacilityType);
}

/**
 * Locked tools are on; a tool the user turned off is off; otherwise it is on when the facility of the record has it
 * on, or, without one, when any of the user's facilities does. A tool missing from the catalogue (an MCP or profile
 * tool) isn't governed here; the registry spec keeps every built-in tool in the catalogue.
 */
function isEnabled(state: UserToolState, toolName: string, facilityId?: string): boolean {
	const entry = wiseToolEntry(toolName);
	if (!entry || entry.locked) {
		return true;
	}
	if (entry.comingSoon || userOptOut(state, toolName) === false) {
		return false;
	}
	const record = facilityId ? state.facilities.find((facility) => facility.id === facilityId) : undefined;
	if (record) {
		return facilityOn(state, record, toolName);
	}
	if (state.facilities.length === 0) {
		return isWiseToolOnByDefault(toolName, NO_FACILITY_TYPE);
	}
	return state.facilities.some((facility) => facilityOn(state, facility, toolName));
}
