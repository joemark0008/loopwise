import type { WiseToolSettingsQuery } from '@/graphql/generated/graphql';

import {
	SetMyWiseToolEnabledDocument,
	SetWiseToolEnabledDocument,
	WiseToolSettingsDocument,
} from '@/graphql/generated/graphql';
import { mutation, query, runMutation, runQuery } from '@/lib/apollo-procedures';

export type WiseToolSettings = WiseToolSettingsQuery['wiseToolSettings'];
export type WiseToolRow = WiseToolSettings['tools'][number];

/** Settings → Wise tools (`apps/api/src/wise-tools`): which tools Wise may use, per facility and for yourself. */
export const wiseToolsApi = {
	settings: query<{ facilityId: string | null }, WiseToolSettings>(
		['wiseTools', 'settings'],
		async ({ facilityId }) => (await runQuery(WiseToolSettingsDocument, { facilityId })).wiseToolSettings,
	),
	setFacility: mutation<{ facilityId: string; toolName: string; enabled: boolean }, boolean>(
		['wiseTools', 'setFacility'],
		async (variables) => (await runMutation(SetWiseToolEnabledDocument, variables)).setWiseToolEnabled,
	),
	setMine: mutation<{ toolName: string; enabled: boolean }, boolean>(
		['wiseTools', 'setMine'],
		async (variables) => (await runMutation(SetMyWiseToolEnabledDocument, variables)).setMyWiseToolEnabled,
	),
};
