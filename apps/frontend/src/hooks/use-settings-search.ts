import Fuse from 'fuse.js';
import { useMemo } from 'react';

import type { SettingsSearchEntry } from '@/feature/settings/components/settings-search-index';
import { settingsSearchIndex } from '@/feature/settings/components/settings-search-index';
import { useCanSeeAdvancedSettings } from '@/hooks/use-can-see-advanced-settings';
import { useIsCloud } from '@/hooks/use-quarry-mode';
import { usePermissions } from '@/hooks/use-permissions';
import { usePublicConfig } from '@/hooks/use-public-config';

export function useSettingsSearch(query: string): SettingsSearchEntry[] {
	const visibleEntries = useVisibleSettingsEntries();

	const fuse = useMemo(
		() =>
			new Fuse(visibleEntries, {
				keys: [
					{ name: 'title', weight: 0.4 },
					{ name: 'pageLabel', weight: 0.25 },
					{ name: 'description', weight: 0.2 },
					{ name: 'keywords', weight: 0.15 },
				],
				threshold: 0.4,
				includeScore: true,
			}),
		[visibleEntries],
	);

	return useMemo(() => {
		if (query.length < 2) {
			return [];
		}

		const matches = fuse.search(query, { limit: 8 }).map((result) => result.item);
		return dedupeByDestination(matches);
	}, [fuse, query]);
}

export function useSettingsSuggestions(): SettingsSearchEntry[] {
	const visibleEntries = useVisibleSettingsEntries();

	return useMemo(
		() =>
			settingsSuggestionPages.flatMap((page) => {
				const entry = visibleEntries.find((candidate) => candidate.page === page);
				return entry ? [entry] : [];
			}),
		[visibleEntries],
	);
}

function useVisibleSettingsEntries(): SettingsSearchEntry[] {
	const { isAdmin, isContextAdmin } = usePermissions();
	const canSeeAdvancedSettings = useCanSeeAdvancedSettings();
	const isCloud = useIsCloud();
	const config = usePublicConfig();
	const betaSubagentsEnabled = config.data?.betaSubagentsEnabled === true;

	return useMemo(
		() =>
			settingsSearchIndex
				.filter(
					(entry) =>
						(!entry.adminOnly || isAdmin) &&
						(!entry.nonAdminOnly || !isAdmin) &&
						(!entry.adminOrContextAdmin || isAdmin || isContextAdmin) &&
						(!entry.cloudHidden || !isCloud) &&
						(!entry.betaSubagentsOnly || betaSubagentsEnabled),
				)
				.filter((entry) => canSeeAdvancedSettings || viewerVisiblePages.includes(entry.page)),
		[betaSubagentsEnabled, canSeeAdvancedSettings, isAdmin, isCloud, isContextAdmin],
	);
}

function dedupeByDestination(entries: SettingsSearchEntry[]): SettingsSearchEntry[] {
	const seenDestinations = new Set<string>();
	return entries.filter((entry) => {
		const destination = `${entry.page}:${JSON.stringify(entry.search ?? {})}`;
		if (seenDestinations.has(destination)) {
			return false;
		}

		seenDestinations.add(destination);
		return true;
	});
}

const settingsSuggestionPages = [
	'/settings/account',
	'/settings/project',
	'/settings/context-explorer',
	'/settings/project/agent',
	'/settings/project/warehouse',
	'/settings/project/query-tools',
];

const viewerVisiblePages = ['/settings/account'];
