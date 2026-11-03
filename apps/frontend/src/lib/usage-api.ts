import type {
	Granularity,
	SavedUsagePeriod,
	SavedUsagePeriodInput,
	TotalUsageRecord,
	UsageByUserRecord,
	UsageFilter,
	UsagePeriodSelection,
	UsageRecord,
} from '@loopwise/shared/usage';
import type { LlmProvider } from '@loopwise/shared/types';

import {
	CreateSavedUsagePeriodDocument,
	DeleteSavedUsagePeriodDocument,
	UpdateSavedUsagePeriodDocument,
	UpdateUsagePeriodSelectionDocument,
	UsageByUserDocument,
	UsageMessagesDocument,
	UsagePeriodSettingsDocument,
	UsageProvidersDocument,
	UsageTotalDocument,
	UsageUserFacetsDocument,
} from '@/graphql/generated/graphql';
import { mutation, query, runMutation, runQuery } from '@/lib/apollo-procedures';

type UsagePeriodSettings = { selection: UsagePeriodSelection | null; savedPeriods: SavedUsagePeriod[] };

/** Users of the project and their chat count, for the users filter (upstream's chat replay facets). */
export type UsageUserFacets = { userNames: string[]; userNameCounts: Record<string, number> };

/**
 * Settings → Usage on apps/api (`lib/apollo-procedures.ts`): call sites swap upstream tRPC's `usage.*` for
 * `usageApi.usage.*`.
 */
export const usageApi = {
	usage: {
		getMessagesUsage: query<UsageFilter, UsageRecord[]>(
			['usage', 'getMessagesUsage'],
			async (filter) => (await runQuery(UsageMessagesDocument, { filter })).usageMessages,
		),
		getMessagesUsageByUser: query<UsageFilter, UsageByUserRecord[]>(
			['usage', 'getMessagesUsageByUser'],
			async (filter) => (await runQuery(UsageByUserDocument, { filter })).usageByUser,
		),
		getTotalUsage: query<UsageFilter, TotalUsageRecord>(
			['usage', 'getTotalUsage'],
			async (filter) => (await runQuery(UsageTotalDocument, { filter })).usageTotal,
		),
		getUsedProviders: query<void, LlmProvider[]>(
			['usage', 'getUsedProviders'],
			async () => (await runQuery(UsageProvidersDocument, {})).usageProviders as LlmProvider[],
		),
		getUserFacets: query<void, UsageUserFacets>(['usage', 'getUserFacets'], async () => {
			const facets = (await runQuery(UsageUserFacetsDocument, {})).usageUserFacets;
			return {
				userNames: facets.map((facet) => facet.userName),
				userNameCounts: Object.fromEntries(facets.map((facet) => [facet.userName, facet.chatCount])),
			};
		}),
		getPeriodSettings: query<{ projectId: string }, UsagePeriodSettings>(
			['usage', 'getPeriodSettings'],
			async ({ projectId }) => {
				const { selection, savedPeriods } = (await runQuery(UsagePeriodSettingsDocument, { projectId }))
					.usagePeriodSettings;
				return { selection: toSelection(selection), savedPeriods: savedPeriods.map(toSavedPeriod) };
			},
		),
		updatePeriodSelection: mutation<
			{ projectId: string; selection: UsagePeriodSelection },
			UsagePeriodSelection | null
		>(['usage', 'updatePeriodSelection'], async ({ projectId, selection }) =>
			toSelection(
				(await runMutation(UpdateUsagePeriodSelectionDocument, { projectId, selection }))
					.updateUsagePeriodSelection,
			),
		),
		createSavedPeriod: mutation<{ projectId: string; savedPeriod: SavedUsagePeriodInput }, SavedUsagePeriod>(
			['usage', 'createSavedPeriod'],
			async ({ projectId, savedPeriod }) =>
				toSavedPeriod(
					(await runMutation(CreateSavedUsagePeriodDocument, { projectId, savedPeriod }))
						.createSavedUsagePeriod,
				),
		),
		updateSavedPeriod: mutation<{ projectId: string; savedPeriod: SavedUsagePeriod }, SavedUsagePeriod>(
			['usage', 'updateSavedPeriod'],
			async ({ projectId, savedPeriod }) =>
				toSavedPeriod(
					(await runMutation(UpdateSavedUsagePeriodDocument, { projectId, savedPeriod }))
						.updateSavedUsagePeriod,
				),
		),
		deleteSavedPeriod: mutation<
			{ projectId: string; id: string },
			{ id: string; selection: UsagePeriodSelection | null }
		>(['usage', 'deleteSavedPeriod'], async ({ projectId, id }) => {
			const deleted = (await runMutation(DeleteSavedUsagePeriodDocument, { projectId, id }))
				.deleteSavedUsagePeriod;
			return { id: deleted.id, selection: toSelection(deleted.selection) };
		}),
	},
};

function toSelection(
	selection: { mode: string; savedPeriodId?: string | null } | null | undefined,
): UsagePeriodSelection | null {
	if (!selection) {
		return null;
	}
	return selection.mode === 'saved'
		? { mode: 'saved', savedPeriodId: selection.savedPeriodId ?? '' }
		: ({ mode: selection.mode } as UsagePeriodSelection);
}

function toSavedPeriod(savedPeriod: { id: string; days: number; granularity: string }): SavedUsagePeriod {
	return { id: savedPeriod.id, days: savedPeriod.days, granularity: savedPeriod.granularity as Granularity };
}
