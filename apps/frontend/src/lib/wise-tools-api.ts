import type { WiseToolSettingsQuery } from '@/graphql/generated/graphql';

import {
	SetMyWiseToolEnabledDocument,
	SetWiseToolEnabledDocument,
	WiseToolSettingsDocument,
} from '@/graphql/generated/graphql';
import { mutation, query, runMutation, runQuery } from '@/lib/apollo-procedures';

export type WiseToolSettings = WiseToolSettingsQuery['wiseToolSettings'];
export type WiseToolRow = WiseToolSettings['tools'][number];

/** Settings → Wise tools (`apps/api/src/wise-tools`): which tools Wise may use, per organization and for yourself. */
export const wiseToolsApi = {
	settings: query<{ organizationId: string | null }, WiseToolSettings>(
		['wiseTools', 'settings'],
		async ({ organizationId }) => (await runQuery(WiseToolSettingsDocument, { organizationId })).wiseToolSettings,
	),
	setOrganization: mutation<{ organizationId: string; toolName: string; enabled: boolean }, boolean>(
		['wiseTools', 'setOrganization'],
		async (variables) => (await runMutation(SetWiseToolEnabledDocument, variables)).setWiseToolEnabled,
	),
	setMine: mutation<{ toolName: string; enabled: boolean }, boolean>(
		['wiseTools', 'setMine'],
		async (variables) => (await runMutation(SetMyWiseToolEnabledDocument, variables)).setMyWiseToolEnabled,
	),
};
