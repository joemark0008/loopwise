import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	DEFAULT_USAGE_PERIOD_SELECTION,
	resolveUsagePeriod,
	resolveUsagePeriodGranularity,
} from '@loopwise/shared/usage';
import type { SavedUsagePeriod, SavedUsagePeriodInput, UsagePeriodSelection } from '@loopwise/shared/usage';
import type { UsageRouteSearch } from '@/feature/settings/components/usage-route-search';
import {
	clearStoredUsagePeriodSelection,
	readStoredUsagePeriodSelection,
} from '@/feature/settings/components/usage-route-search';
import { usageApi } from '@/lib/usage-api';
import { getActiveClinicId } from '@/lib/active-clinic';

interface UseUsagePeriodSettingsOptions {
	canViewUsage: boolean;
	usageSearch: UsageRouteSearch;
	onUpdateSearch: (next: Partial<UsageRouteSearch>) => void;
}

interface UsagePeriodSettings {
	selection: UsagePeriodSelection | null;
	savedPeriods: SavedUsagePeriod[];
}

export function useUsagePeriodSettings({ canViewUsage, usageSearch, onUpdateSearch }: UseUsagePeriodSettingsOptions) {
	const queryClient = useQueryClient();
	const clinicId = getActiveClinicId();
	const queryClinicId = clinicId ?? '';
	const queriesEnabled = canViewUsage && clinicId !== null;
	const legacyPeriodSelection = useMemo(() => readStoredUsagePeriodSelection(clinicId), [clinicId]);
	const [actionError, setActionError] = useState<ClinicActionError>();
	const [migrationStatuses, setMigrationStatuses] = useState<Record<string, MigrationStatus>>({});
	const selectionVersion = useRef(0);
	const migrationStatus = migrationStatuses[queryClinicId];

	const settingsOptions = usageApi.usage.getPeriodSettings.queryOptions({ clinicId: queryClinicId });
	const settingsQuery = useQuery({
		...settingsOptions,
		enabled: queriesEnabled,
	});

	const updateSelection = useMutation({
		...usageApi.usage.updatePeriodSelection.mutationOptions({
			onMutate: async ({ clinicId: mutationClinicId, selection: nextSelection }) => {
				const queryKey = getPeriodSettingsQueryKey(mutationClinicId);
				await queryClient.cancelQueries({ queryKey });
				const previousSettings = queryClient.getQueryData<UsagePeriodSettings>(queryKey);
				queryClient.setQueryData<UsagePeriodSettings>(queryKey, (current) =>
					current ? { ...current, selection: nextSelection } : current,
				);
				return { previousSettings };
			},
			onError: (_error, { clinicId: mutationClinicId }, context) => {
				queryClient.setQueryData(getPeriodSettingsQueryKey(mutationClinicId), context?.previousSettings);
			},
			onSettled: (_data, _error, { clinicId: mutationClinicId }) => {
				queryClient.invalidateQueries({ queryKey: getPeriodSettingsQueryKey(mutationClinicId) });
			},
		}),
		scope: { id: `usage-period-selection-${queryClinicId}` },
	});

	const createSavedPeriodMutation = useMutation(
		usageApi.usage.createSavedPeriod.mutationOptions({
			onSuccess: (savedPeriod, { clinicId: mutationClinicId }) => {
				queryClient.setQueryData<UsagePeriodSettings>(
					getPeriodSettingsQueryKey(mutationClinicId),
					(current) => ({
						selection: { mode: 'saved', savedPeriodId: savedPeriod.id },
						savedPeriods: [...(current?.savedPeriods ?? []), savedPeriod],
					}),
				);
			},
			onSettled: (_data, _error, { clinicId: mutationClinicId }) => {
				queryClient.invalidateQueries({ queryKey: getPeriodSettingsQueryKey(mutationClinicId) });
			},
		}),
	);

	const updateSavedPeriodMutation = useMutation(
		usageApi.usage.updateSavedPeriod.mutationOptions({
			onMutate: async ({ clinicId: mutationClinicId, savedPeriod }) => {
				const queryKey = getPeriodSettingsQueryKey(mutationClinicId);
				await queryClient.cancelQueries({ queryKey });
				const previousSettings = queryClient.getQueryData<UsagePeriodSettings>(queryKey);
				queryClient.setQueryData<UsagePeriodSettings>(queryKey, (current) =>
					current
						? {
								...current,
								savedPeriods: current.savedPeriods.map((item) =>
									item.id === savedPeriod.id ? savedPeriod : item,
								),
							}
						: current,
				);
				return { previousSettings };
			},
			onError: (_error, { clinicId: mutationClinicId }, context) => {
				queryClient.setQueryData(getPeriodSettingsQueryKey(mutationClinicId), context?.previousSettings);
			},
			onSettled: (_data, _error, { clinicId: mutationClinicId }) => {
				queryClient.invalidateQueries({ queryKey: getPeriodSettingsQueryKey(mutationClinicId) });
			},
		}),
	);

	const deleteSavedPeriodMutation = useMutation(
		usageApi.usage.deleteSavedPeriod.mutationOptions({
			onMutate: async ({ clinicId: mutationClinicId, id }) => {
				const queryKey = getPeriodSettingsQueryKey(mutationClinicId);
				await queryClient.cancelQueries({ queryKey });
				const previousSettings = queryClient.getQueryData<UsagePeriodSettings>(queryKey);
				queryClient.setQueryData<UsagePeriodSettings>(queryKey, (current) => {
					if (!current) {
						return current;
					}
					const selection =
						current.selection?.mode === 'saved' && current.selection.savedPeriodId === id
							? DEFAULT_USAGE_PERIOD_SELECTION
							: current.selection;
					return {
						selection,
						savedPeriods: current.savedPeriods.filter((savedPeriod) => savedPeriod.id !== id),
					};
				});
				return { previousSettings };
			},
			onError: (_error, { clinicId: mutationClinicId }, context) => {
				queryClient.setQueryData(getPeriodSettingsQueryKey(mutationClinicId), context?.previousSettings);
			},
			onSettled: (_data, _error, { clinicId: mutationClinicId }) => {
				queryClient.invalidateQueries({ queryKey: getPeriodSettingsQueryKey(mutationClinicId) });
			},
		}),
	);

	const savedPeriods = settingsQuery.data?.savedPeriods ?? [];
	const savedSelection = settingsQuery.data?.selection ?? legacyPeriodSelection ?? DEFAULT_USAGE_PERIOD_SELECTION;
	const selection = resolvePeriodSelection(
		savedSelection,
		settingsQuery.data?.savedPeriods,
		usageSearch.savedPeriodId,
		usageSearch.periodMode,
	);

	const selectPeriod = async (nextSelection: UsagePeriodSelection) => {
		const mutationClinicId = queryClinicId;
		const previousSelection = selection;
		const version = ++selectionVersion.current;
		const replacesLegacySelection =
			migrationStatus === 'failed' &&
			settingsQuery.data?.selection === null &&
			legacyPeriodSelection !== undefined;
		setActionError(undefined);
		if (replacesLegacySelection) {
			setMigrationStatuses((current) => ({ ...current, [mutationClinicId]: 'pending' }));
		}
		onUpdateSearch(toPeriodSearch(nextSelection));
		try {
			await updateSelection.mutateAsync({ clinicId: mutationClinicId, selection: nextSelection });
			if (replacesLegacySelection) {
				clearStoredUsagePeriodSelection(mutationClinicId);
				setMigrationStatuses((current) => ({ ...current, [mutationClinicId]: 'succeeded' }));
			}
		} catch (cause) {
			if (replacesLegacySelection) {
				setMigrationStatuses((current) => ({ ...current, [mutationClinicId]: 'failed' }));
			}
			if (version === selectionVersion.current && isActiveClinic(mutationClinicId)) {
				onUpdateSearch(toPeriodSearch(previousSelection));
				setActionError({
					clinicId: mutationClinicId,
					message: toErrorMessage(cause, 'Unable to save the selected period.'),
				});
			}
			throw cause;
		}
	};

	const createSavedPeriod = async (input: SavedUsagePeriodInput) => {
		const mutationClinicId = queryClinicId;
		setActionError(undefined);
		const savedPeriod = await createSavedPeriodMutation.mutateAsync({
			clinicId: mutationClinicId,
			savedPeriod: input,
		});
		if (isActiveClinic(mutationClinicId)) {
			onUpdateSearch(toPeriodSearch({ mode: 'saved', savedPeriodId: savedPeriod.id }));
		}
		if (
			migrationStatus === 'failed' &&
			settingsQuery.data?.selection === null &&
			legacyPeriodSelection !== undefined
		) {
			clearStoredUsagePeriodSelection(mutationClinicId);
			setMigrationStatuses((current) => ({ ...current, [mutationClinicId]: 'succeeded' }));
		}
	};

	const updateSavedPeriod = async (savedPeriod: SavedUsagePeriod) => {
		setActionError(undefined);
		await updateSavedPeriodMutation.mutateAsync({ clinicId: queryClinicId, savedPeriod });
	};

	const deleteSavedPeriod = async (id: string) => {
		const mutationClinicId = queryClinicId;
		setActionError(undefined);
		const isActive = selection.mode === 'saved' && selection.savedPeriodId === id;
		await deleteSavedPeriodMutation.mutateAsync({ clinicId: mutationClinicId, id });
		if (isActive && isActiveClinic(mutationClinicId)) {
			onUpdateSearch(toPeriodSearch(DEFAULT_USAGE_PERIOD_SELECTION));
		}
	};

	const retry = async () => {
		setActionError(undefined);
		if (loadError) {
			await settingsQuery.refetch();
			return;
		}
		if (migrationStatus !== 'failed' || !legacyPeriodSelection) {
			return;
		}

		const migrationClinicId = queryClinicId;
		setMigrationStatuses((current) => ({ ...current, [migrationClinicId]: 'pending' }));
		try {
			const settings = await queryClient.fetchQuery(
				usageApi.usage.getPeriodSettings.queryOptions({ clinicId: migrationClinicId }),
			);
			if (settings.selection === null) {
				await updateSelection.mutateAsync({
					clinicId: migrationClinicId,
					selection: legacyPeriodSelection,
				});
			}
			clearStoredUsagePeriodSelection(migrationClinicId);
			setMigrationStatuses((current) => ({ ...current, [migrationClinicId]: 'succeeded' }));
		} catch (cause) {
			setMigrationStatuses((current) => ({ ...current, [migrationClinicId]: 'failed' }));
			if (isActiveClinic(migrationClinicId)) {
				setActionError({
					clinicId: migrationClinicId,
					message: toErrorMessage(cause, 'Unable to migrate the saved period.'),
				});
			}
		}
	};

	useEffect(() => {
		if (!queriesEnabled || !settingsQuery.data || !legacyPeriodSelection) {
			return;
		}
		if (settingsQuery.data.selection !== null) {
			if (migrationStatus === undefined) {
				clearStoredUsagePeriodSelection(queryClinicId);
			}
			return;
		}
		if (migrationStatus !== undefined) {
			return;
		}

		const migrationClinicId = queryClinicId;
		setMigrationStatuses((current) => ({ ...current, [migrationClinicId]: 'pending' }));
		void updateSelection
			.mutateAsync({ clinicId: migrationClinicId, selection: legacyPeriodSelection })
			.then(() => {
				clearStoredUsagePeriodSelection(migrationClinicId);
				setMigrationStatuses((current) => ({ ...current, [migrationClinicId]: 'succeeded' }));
			})
			.catch((cause) => {
				setMigrationStatuses((current) => ({ ...current, [migrationClinicId]: 'failed' }));
				if (isActiveClinic(migrationClinicId)) {
					setActionError({
						clinicId: migrationClinicId,
						message: toErrorMessage(cause, 'Unable to migrate the saved period.'),
					});
				}
			});
	}, [legacyPeriodSelection, migrationStatus, queriesEnabled, queryClinicId, settingsQuery.data, updateSelection]);

	useEffect(() => {
		const savedPeriodId = usageSearch.savedPeriodId;
		if (
			!settingsQuery.isSuccess ||
			deleteSavedPeriodMutation.isPending ||
			!savedPeriodId ||
			settingsQuery.data.savedPeriods.some((savedPeriod) => savedPeriod.id === savedPeriodId) ||
			!isActiveClinic(queryClinicId)
		) {
			return;
		}
		onUpdateSearch({ savedPeriodId: undefined });
	}, [
		deleteSavedPeriodMutation.isPending,
		onUpdateSearch,
		queryClinicId,
		settingsQuery.data,
		settingsQuery.isSuccess,
		usageSearch.savedPeriodId,
	]);

	const loadError = settingsQuery.error;
	const currentActionError = actionError?.clinicId === queryClinicId ? actionError.message : undefined;
	const migrationError = migrationStatus === 'failed' ? 'Unable to migrate the saved period.' : undefined;
	const error =
		currentActionError ??
		migrationError ??
		(loadError ? toErrorMessage(loadError, 'Unable to load saved periods.') : undefined);
	const isMigrationBlocking =
		migrationStatus === 'pending' ||
		(settingsQuery.data?.selection === null &&
			legacyPeriodSelection !== undefined &&
			migrationStatus === undefined);
	const isReady = settingsQuery.isSuccess && !isMigrationBlocking;

	return {
		savedPeriods,
		selection,
		period: resolveUsagePeriod(selection, savedPeriods),
		granularity: resolveUsagePeriodGranularity(selection, savedPeriods),
		isLoading: canViewUsage && (clinicId === null || (!isReady && !loadError)),
		isReady,
		error,
		retry: loadError || migrationStatus === 'failed' ? () => void retry() : undefined,
		selectPeriod,
		createSavedPeriod,
		updateSavedPeriod,
		deleteSavedPeriod,
	};
}

function resolvePeriodSelection(
	savedSelection: UsagePeriodSelection,
	savedPeriods: SavedUsagePeriod[] | undefined,
	savedPeriodId: string | undefined,
	mode: UsageRouteSearch['periodMode'],
): UsagePeriodSelection {
	if (savedPeriodId && (!savedPeriods || savedPeriods.some(({ id }) => id === savedPeriodId))) {
		return { mode: 'saved', savedPeriodId };
	}
	if (mode) {
		return { mode };
	}
	if (
		savedSelection.mode === 'saved' &&
		savedPeriods &&
		!savedPeriods.some(({ id }) => id === savedSelection.savedPeriodId)
	) {
		return DEFAULT_USAGE_PERIOD_SELECTION;
	}
	return savedSelection;
}

function toPeriodSearch(selection: UsagePeriodSelection): Partial<UsageRouteSearch> {
	return {
		periodMode: selection.mode === 'saved' ? undefined : selection.mode,
		savedPeriodId: selection.mode === 'saved' ? selection.savedPeriodId : undefined,
	};
}

function toErrorMessage(cause: unknown, fallback: string): string {
	return cause instanceof Error && cause.message ? cause.message : fallback;
}

function isActiveClinic(clinicId: string): boolean {
	return getActiveClinicId() === clinicId;
}

function getPeriodSettingsQueryKey(clinicId: string) {
	return usageApi.usage.getPeriodSettings.queryOptions({ clinicId }).queryKey;
}

type MigrationStatus = 'pending' | 'failed' | 'succeeded';
type ClinicActionError = { clinicId: string; message: string };
