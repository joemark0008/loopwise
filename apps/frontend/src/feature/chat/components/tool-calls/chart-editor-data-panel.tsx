import { CalendarDays, CaseSensitive, Hash, PanelLeftClose, PanelLeftOpen, Search, ToggleLeft } from 'lucide-react';
import { useMemo, useState } from 'react';
import styles from './chart-editor-data-panel.module.css';
import type { LucideIcon } from 'lucide-react';

import type { ChartSelectionSummary, ColumnProfile, ColumnValueKind } from '@/lib/chart-selection-summary';
import { Button } from '@/components/ui/button';
import { DatabaseIcon } from '@/components/ui/database-icon';
import { Input } from '@/components/ui/input';
import { startColumnDrag } from '@/hooks/use-column-drag';
import { profileColumn } from '@/lib/chart-selection-summary';
import { cn } from '@/lib/utils';

const X_AXIS_USAGE_COLOR = 'var(--app-muted)';

const KIND_ICONS: Record<ColumnValueKind, LucideIcon> = {
	number: Hash,
	date: CalendarDays,
	boolean: ToggleLeft,
	text: CaseSensitive,
	mixed: CaseSensitive,
	empty: CaseSensitive,
};

interface ChartEditorDataPanelProps {
	columns: string[];
	data: Record<string, unknown>[];
	summary: ChartSelectionSummary;
	onCollapse: () => void;
	onEditQuery?: () => void;
	isEditingQuery?: boolean;
	dialect?: string;
	className?: string;
}

/** Left pane of the chart editor: the query result columns and the entry point to edit the SQL. */
export function ChartEditorDataPanel({
	columns,
	data,
	summary,
	onCollapse,
	onEditQuery,
	isEditingQuery = false,
	dialect,
	className,
}: ChartEditorDataPanelProps) {
	const [search, setSearch] = useState('');
	const profiles = useMemo(() => columns.map((column) => profileColumn(data, column)), [columns, data]);
	const usageByColumn = useMemo(() => buildColumnUsage(summary), [summary]);
	const visibleProfiles = filterProfiles(profiles, search);

	return (
		<aside className={cn(styles.chartEditorDataPanelAside, className)}>
			{onEditQuery && (
				<div className={styles.chartEditorDataPanelDiv}>
					<Button
						type='button'
						variant='outline'
						size='sm'
						className={styles.chartEditorDataPanelButton}
						onClick={onEditQuery}
						disabled={isEditingQuery}
					>
						<DatabaseIcon dialect={dialect} className={styles.chartEditorDataPanelDatabaseIcon} />
						{isEditingQuery ? 'Editing SQL' : 'Edit SQL'}
					</Button>
				</div>
			)}
			<div className={styles.chartEditorDataPanelDiv2}>
				<div className={styles.chartEditorDataPanelDiv3}>
					<h3 className={styles.chartEditorDataPanelH3}>Data</h3>
					<span className={styles.chartEditorDataPanelSpan}>{formatCount(data.length, 'row')}</span>
					<Button
						type='button'
						variant='ghost-muted'
						size='icon-xs'
						className={styles.chartEditorDataPanelButton2}
						onClick={onCollapse}
						aria-label='Collapse data panel'
						title='Collapse data panel'
					>
						<PanelLeftClose className={styles.chartEditorDataPanelDatabaseIcon} />
					</Button>
				</div>
				<div className={styles.chartEditorDataPanelDiv4}>
					<Search className={styles.chartEditorDataPanelSearch} />
					<Input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder='Search columns'
						aria-label='Search columns'
						className={styles.chartEditorDataPanelInput}
					/>
				</div>
			</div>
			<ul className={styles.chartEditorDataPanelUl}>
				{visibleProfiles.map((profile) => (
					<ColumnRow
						key={profile.column}
						profile={profile}
						usageColors={usageByColumn.get(profile.column.toLowerCase())}
					/>
				))}
				{visibleProfiles.length === 0 && (
					<li className={styles.chartEditorDataPanelLi}>No matching columns.</li>
				)}
			</ul>
		</aside>
	);
}

interface ChartEditorDataRailProps {
	onExpand: () => void;
	onEditQuery?: () => void;
	isEditingQuery?: boolean;
	dialect?: string;
}

/** The data pane once collapsed: a thin rail to reopen it or jump to the SQL editor. */
export function ChartEditorDataRail({
	onExpand,
	onEditQuery,
	isEditingQuery = false,
	dialect,
}: ChartEditorDataRailProps) {
	return (
		<div className={styles.chartEditorDataRailDiv}>
			<Button
				type='button'
				variant='ghost-muted'
				size='icon-sm'
				onClick={onExpand}
				aria-label='Expand data panel'
				title='Expand data panel'
			>
				<PanelLeftOpen className={styles.chartEditorDataRailPanelLeftOpen} />
			</Button>
			{onEditQuery && (
				<Button
					type='button'
					variant='ghost-muted'
					size='icon-sm'
					onClick={onEditQuery}
					disabled={isEditingQuery}
					aria-label='Edit SQL'
					title='Edit SQL'
				>
					<DatabaseIcon dialect={dialect} className={styles.chartEditorDataRailPanelLeftOpen} />
				</Button>
			)}
		</div>
	);
}

function ColumnRow({ profile, usageColors }: { profile: ColumnProfile; usageColors?: string[] }) {
	const Icon = KIND_ICONS[profile.kind];
	return (
		<li
			draggable
			onDragStart={(event) => startColumnDrag(event, profile.column, profile.kind)}
			className={styles.columnRowLi}
			title={`${profile.column} · ${profile.kind} · drag onto a chart field`}
		>
			<Icon className={styles.columnRowIcon} />
			<span className={styles.columnRowSpan}>{profile.column}</span>
			{usageColors?.map((color, index) => (
				<span
					key={`${color}-${index}`}
					className={styles.columnRowSpan2}
					style={{ backgroundColor: color }}
					aria-hidden
				/>
			))}
		</li>
	);
}

function buildColumnUsage(summary: ChartSelectionSummary): Map<string, string[]> {
	const usage = new Map<string, string[]>();
	const addUsage = (column: string, color: string) => {
		const key = column.toLowerCase();
		usage.set(key, [...(usage.get(key) ?? []), color]);
	};
	if (summary.xAxis?.exists) {
		addUsage(summary.xAxis.column, X_AXIS_USAGE_COLOR);
	}
	for (const series of summary.series) {
		if (series.profile.exists) {
			addUsage(series.profile.column, series.color);
		}
	}
	return usage;
}

function filterProfiles(profiles: ColumnProfile[], search: string): ColumnProfile[] {
	const needle = search.trim().toLowerCase();
	if (!needle) {
		return profiles;
	}
	return profiles.filter((profile) => profile.column.toLowerCase().includes(needle));
}

function formatCount(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
