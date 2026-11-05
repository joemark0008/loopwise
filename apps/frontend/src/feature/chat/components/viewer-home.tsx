import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { ViewerToolbarControls } from './viewer-toolbar-controls';
import { ViewerEmptyState, ViewerGroups } from './viewer-shared-items';
import styles from './viewer-home.module.css';
import type { StoryPanelDisplayMode, Visibility } from '@loopwise/shared/types';
import type { GroupBy, SharedItem } from '@/lib/viewer-home';
import { MobileHeader } from '@/layout/mobile-header';
import { ClinicSwitcher } from '@/components/clinic-selector';
import { NoResults } from '@/components/item-card';
import { Spinner } from '@/components/ui/spinner';
import { useMultiClinic } from '@/hooks/use-multi-clinic';
import { useClinicSwitch } from '@/hooks/use-clinic-switch';
import { VIEWER_DISPLAY_KEY, VIEWER_GROUP_KEY, filterItems, getStoredSetting, groupItems } from '@/lib/viewer-home';
import { useCurrentClinic, useClinics } from '@/hooks/use-current-clinic';
import { chatApi } from '@/lib/chat-api';

export function ViewerHome() {
	const clinic = useCurrentClinic();
	const clinics = useClinics();
	const clinicId = clinic.data?.id;
	const switchClinic = useClinicSwitch(clinicId);
	const multiClinicMode = useMultiClinic();
	const sharedChats = useQuery(chatApi.sharedChat.list.queryOptions());
	const [searchQuery, setSearchQuery] = useState('');
	const [displayMode, setDisplayMode] = useState<StoryPanelDisplayMode>(() =>
		getStoredSetting(VIEWER_DISPLAY_KEY, ['grid', 'lines'], 'grid'),
	);
	const [groupBy, setGroupBy] = useState<GroupBy>(() =>
		getStoredSetting(VIEWER_GROUP_KEY, ['type', 'date', 'author'], 'type'),
	);

	function handleDisplayChange(mode: StoryPanelDisplayMode) {
		setDisplayMode(mode);
		localStorage.setItem(VIEWER_DISPLAY_KEY, mode);
	}

	function handleGroupChange(value: GroupBy) {
		setGroupBy(value);
		localStorage.setItem(VIEWER_GROUP_KEY, value);
	}

	const allItems: SharedItem[] = useMemo(() => {
		const chatItems: SharedItem[] = (sharedChats.data ?? [])
			.filter((c) => c.clinicId === clinicId)
			.map((c) => ({
				id: c.id,
				kind: 'chat',
				title: c.title,
				authorName: c.authorName,
				createdAt: new Date(c.createdAt),
				visibility: c.visibility as Visibility,
				messageBubbles: c.messageBubbles,
			}));
		return chatItems;
	}, [sharedChats.data, clinicId]);

	const filteredItems = useMemo(() => filterItems(allItems, searchQuery), [allItems, searchQuery]);
	const groups = useMemo(() => groupItems(filteredItems, groupBy), [filteredItems, groupBy]);

	const isLoading = sharedChats.isLoading || clinic.isLoading;
	const isEmpty = allItems.length === 0 && !isLoading;

	const clinicSelector = multiClinicMode === 'switch' && clinic.data && (clinics.data?.length ?? 0) > 1 && (
		<div className={styles.clinicSelectorDiv}>
			<ClinicSwitcher
				clinics={clinics.data ?? []}
				currentClinicId={clinic.data.id}
				onChange={switchClinic}
				variant='inline'
			/>
		</div>
	);

	const standaloneClinicSelector = clinicSelector && (
		<div className={styles.standaloneClinicSelectorDiv}>{clinicSelector}</div>
	);

	if (isLoading) {
		return (
			<div className={styles.viewerHomeDiv}>
				<MobileHeader />
				{standaloneClinicSelector}
				<div className={styles.viewerHomeDiv2}>
					<Spinner />
				</div>
			</div>
		);
	}

	if (isEmpty) {
		return (
			<div className={styles.viewerHomeDiv}>
				<MobileHeader />
				{standaloneClinicSelector}
				<ViewerEmptyState />
			</div>
		);
	}

	return (
		<div className={styles.viewerHomeDiv3}>
			<MobileHeader />
			<div className={styles.viewerHomeDiv4}>
				<div className={styles.viewerHomeDiv5}>
					<h1 className={styles.viewerHomeH1}>Shared with me</h1>
					<div className={styles.viewerHomeDiv6}>
						{clinicSelector}
						<ViewerToolbarControls
							searchQuery={searchQuery}
							onSearchQueryChange={setSearchQuery}
							groupBy={groupBy}
							onGroupByChange={handleGroupChange}
							displayMode={displayMode}
							onDisplayModeChange={handleDisplayChange}
						/>
					</div>
				</div>

				{filteredItems.length === 0 && searchQuery.trim() ? (
					<NoResults query={searchQuery} />
				) : (
					<ViewerGroups groups={groups} displayMode={displayMode} />
				)}
			</div>
		</div>
	);
}
