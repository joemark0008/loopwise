import { LayoutGrid, List, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import styles from './viewer-toolbar-controls.module.css';
import type { KeyboardEvent } from 'react';
import type { StoryPanelDisplayMode } from '@loopwise/shared/types';
import type { GroupBy } from '@/lib/viewer-home';
import { GROUP_BY_LABELS } from '@/lib/viewer-home';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function ViewerToolbarControls({
	searchQuery,
	onSearchQueryChange,
	groupBy,
	onGroupByChange,
	displayMode,
	onDisplayModeChange,
}: {
	searchQuery: string;
	onSearchQueryChange: (value: string) => void;
	groupBy: GroupBy;
	onGroupByChange: (value: GroupBy) => void;
	displayMode: StoryPanelDisplayMode;
	onDisplayModeChange: (value: StoryPanelDisplayMode) => void;
}) {
	return (
		<div className={styles.viewerToolbarControlsDiv}>
			<SearchInput value={searchQuery} onChange={onSearchQueryChange} />
			<GroupBySelect value={groupBy} onChange={onGroupByChange} />
			<DisplayModeToggle value={displayMode} onChange={onDisplayModeChange} />
		</div>
	);
}

function SearchInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
	const [open, setOpen] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (open) {
			inputRef.current?.focus();
		}
	}, [open]);

	function handleClose() {
		setOpen(false);
		onChange('');
	}

	function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === 'Escape') {
			handleClose();
		}
	}

	if (!open) {
		return (
			<Button
				variant='ghost'
				size='icon-xs'
				className={styles.searchInputButton}
				onClick={() => setOpen(true)}
				aria-label='Search shared content'
			>
				<Search className={styles.searchInputSearch} />
			</Button>
		);
	}

	return (
		<div className={styles.searchInputDiv}>
			<Search className={styles.searchInputSearch2} />
			<input
				ref={inputRef}
				type='text'
				value={value}
				onChange={(event) => onChange(event.target.value)}
				onKeyDown={handleKeyDown}
				placeholder='Search...'
				className={styles.searchInputInput}
			/>
			<button type='button' onClick={handleClose} className={styles.searchInputButton2}>
				<X className={styles.searchInputSearch} />
			</button>
		</div>
	);
}

function GroupBySelect({ value, onChange }: { value: GroupBy; onChange: (value: GroupBy) => void }) {
	return (
		<Select value={value} onValueChange={(v) => onChange(v as GroupBy)}>
			<SelectTrigger variant='ghost' size='sm' className={styles.groupBySelectSelectTrigger}>
				<span className={styles.groupBySelectSpan}>Group by</span>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{(Object.keys(GROUP_BY_LABELS) as GroupBy[]).map((key) => (
					<SelectItem key={key} value={key}>
						{GROUP_BY_LABELS[key]}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function DisplayModeToggle({
	value,
	onChange,
}: {
	value: StoryPanelDisplayMode;
	onChange: (value: StoryPanelDisplayMode) => void;
}) {
	return (
		<div className={styles.displayModeToggleDiv}>
			<Button
				variant='ghost'
				size='icon-xs'
				onClick={() => onChange('grid')}
				className={cn(
					value === styles.displayModeToggleButton && styles.displayModeToggleButton2,
					styles.displayModeToggleButton3,
				)}
				aria-label='Grid view'
			>
				<LayoutGrid />
			</Button>
			<Button
				variant='ghost'
				size='icon-xs'
				onClick={() => onChange('lines')}
				className={cn(value === 'lines' && styles.displayModeToggleButton2, styles.displayModeToggleButton3)}
				aria-label='List view'
			>
				<List />
			</Button>
		</div>
	);
}
