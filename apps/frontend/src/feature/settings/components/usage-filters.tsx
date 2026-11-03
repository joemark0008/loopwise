import { useState } from 'react';
import { CheckIcon, Radio, Split, Users } from 'lucide-react';
import { providerLabel } from '@loopwise/shared/types';
import styles from './usage-filters.module.css';
import type {
	SavedUsagePeriod,
	SavedUsagePeriodInput,
	UsagePeriodSelection,
	UsageSource,
} from '@loopwise/shared/usage';
import type { LlmProvider } from '@loopwise/shared/types';
import type { LucideIcon } from 'lucide-react';
import type { UsageUserFacets } from '@/lib/usage-api';
import { UsagePeriodFilter } from '@/feature/settings/components/usage-period-filter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface UsageFiltersProps {
	showUsageControls?: boolean;
	showUserControls?: boolean;
	provider: LlmProvider | 'all';
	onProviderChange: (value: LlmProvider | 'all') => void;
	periodSelection: UsagePeriodSelection;
	onPeriodSelectionChange: (value: UsagePeriodSelection) => void | Promise<void>;
	savedPeriods: SavedUsagePeriod[];
	isPeriodLoading?: boolean;
	periodError?: string;
	onRetryPeriod?: () => void;
	onCreateSavedPeriod: (value: SavedUsagePeriodInput) => void | Promise<void>;
	onUpdateSavedPeriod: (value: SavedUsagePeriod) => void | Promise<void>;
	onDeleteSavedPeriod: (id: string) => void | Promise<void>;
	availableProviders: LlmProvider[] | undefined;
	chatFacets: UsageUserFacets | undefined;
	selectedUserNames: string[] | undefined;
	onSelectedUserNamesChange: (value: string[] | undefined) => void;
	selectedSources: UsageSource[] | undefined;
	onSelectedSourcesChange: (value: UsageSource[] | undefined) => void;
	splitByUser?: boolean;
	onSplitByUserChange?: (value: boolean) => void;
}

export function UsageFilters({
	showUsageControls = true,
	showUserControls = true,
	provider,
	onProviderChange,
	periodSelection,
	onPeriodSelectionChange,
	savedPeriods,
	isPeriodLoading,
	periodError,
	onRetryPeriod,
	onCreateSavedPeriod,
	onUpdateSavedPeriod,
	onDeleteSavedPeriod,
	availableProviders,
	chatFacets,
	selectedUserNames,
	onSelectedUserNamesChange,
	selectedSources,
	onSelectedSourcesChange,
	splitByUser = false,
	onSplitByUserChange,
}: UsageFiltersProps) {
	return (
		<div className={styles.filters}>
			{showUsageControls && (
				<>
					<Select value={provider} onValueChange={(v) => onProviderChange(v as LlmProvider | 'all')}>
						<SelectTrigger className={styles.providerTrigger}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='all'>All providers</SelectItem>
							{availableProviders?.map((p) => (
								<SelectItem key={p} value={p}>
									{providerLabel(p)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<UsagePeriodFilter
						value={periodSelection}
						savedPeriods={savedPeriods}
						isLoading={isPeriodLoading}
						error={periodError}
						onRetry={onRetryPeriod}
						onChange={onPeriodSelectionChange}
						onCreateSavedPeriod={onCreateSavedPeriod}
						onUpdateSavedPeriod={onUpdateSavedPeriod}
						onDeleteSavedPeriod={onDeleteSavedPeriod}
					/>
				</>
			)}

			<SourceAndUserFilters
				chatFacets={chatFacets}
				selectedUserNames={selectedUserNames}
				onSelectedUserNamesChange={onSelectedUserNamesChange}
				selectedSources={selectedSources}
				onSelectedSourcesChange={onSelectedSourcesChange}
				showUserControls={showUserControls}
			/>
			{showUsageControls && showUserControls && onSplitByUserChange && (
				<ToggleFilter
					label='Split per user'
					icon={Split}
					pressed={splitByUser}
					onPressedChange={onSplitByUserChange}
				/>
			)}
		</div>
	);
}

type SourceAndUserFiltersProps = Pick<
	UsageFiltersProps,
	'chatFacets' | 'selectedUserNames' | 'onSelectedUserNamesChange' | 'selectedSources' | 'onSelectedSourcesChange'
> & {
	showUserControls?: boolean;
};

export function SourceAndUserFilters({
	chatFacets,
	selectedUserNames,
	onSelectedUserNamesChange,
	selectedSources,
	onSelectedSourcesChange,
	showUserControls = true,
}: SourceAndUserFiltersProps) {
	const userOptions = (chatFacets?.userNames ?? []).map((name) => ({
		value: name,
		label: name,
		count: chatFacets?.userNameCounts[name],
	}));
	const sourceOptions = LOOPWISE_SOURCES.map((value) => ({
		value,
		label: sourceLabels[value],
	}));

	return (
		<>
			<MultiSelectFilter
				label='Source'
				icon={Radio}
				options={sourceOptions}
				selectedValues={selectedSources}
				onChange={onSelectedSourcesChange}
			/>
			{showUserControls && (
				<MultiSelectFilter
					label='Users'
					icon={Users}
					options={userOptions}
					selectedValues={selectedUserNames}
					onChange={onSelectedUserNamesChange}
				/>
			)}
		</>
	);
}

type ToggleFilterProps = {
	label: string;
	icon: LucideIcon;
	pressed: boolean;
	onPressedChange: (value: boolean) => void;
};

function ToggleFilter({ label, icon: Icon, pressed, onPressedChange }: ToggleFilterProps) {
	return (
		<Button
			variant='ghost'
			size='sm'
			aria-pressed={pressed}
			className={cn(pressed && styles.active)}
			onClick={() => onPressedChange(!pressed)}
		>
			<Icon size={16} />
			{label}
		</Button>
	);
}

type FilterOption<T extends string> = {
	value: T;
	label: string;
	count?: number;
};

type MultiSelectFilterProps<T extends string> = {
	label: string;
	icon: LucideIcon;
	options: FilterOption<T>[];
	selectedValues: T[] | undefined;
	onChange: (value: T[] | undefined) => void;
};

/** The sources loopwise's chats come from (no messaging integrations or MCP server yet, see docs/deferred-features.md). */
const LOOPWISE_SOURCES = ['web', 'contextRecommendations', 'onboarding'] as const satisfies readonly UsageSource[];

const sourceLabels: Record<UsageSource, string> = {
	web: 'Web',
	slack: 'Slack',
	teams: 'Teams',
	telegram: 'Telegram',
	mattermost: 'Mattermost',
	discord: 'Discord',
	whatsapp: 'WhatsApp',
	admin: 'Admin mode',
	mcp: 'MCP',
	contextRecommendations: 'Context recommendations',
	onboarding: 'Onboarding',
};

function sameValues<T extends string>(a: T[], b: T[]): boolean {
	if (a.length !== b.length) {
		return false;
	}
	const setA = new Set(a);
	return b.every((value) => setA.has(value));
}

function MultiSelectFilter<T extends string>({
	label,
	icon: Icon,
	options,
	selectedValues,
	onChange,
}: MultiSelectFilterProps<T>) {
	const allValues = options.map((option) => option.value);
	const committedValues = selectedValues ?? allValues;
	const hasPartialSelection = selectedValues !== undefined && selectedValues.length < allValues.length;

	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState<T[]>(committedValues);
	const isDirty = !sameValues(draft, committedValues);

	const handleOpenChange = (next: boolean) => {
		if (next) {
			setDraft(selectedValues ?? allValues);
		}
		setOpen(next);
	};

	const toggleValue = (value: T) => {
		setDraft((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
	};

	const applyDraft = () => {
		onChange(draft.length === 0 || draft.length === allValues.length ? undefined : draft);
		setOpen(false);
	};

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<Button
					variant='ghost'
					size='sm'
					disabled={options.length === 0}
					className={cn(hasPartialSelection && styles.active)}
				>
					<Icon size={16} />
					{label}
					{hasPartialSelection && (
						<Badge variant='secondary' className={styles.count}>
							{committedValues.length}
						</Badge>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent align='start' className={styles.content}>
				<Command>
					<CommandInput placeholder={`Search ${label.toLowerCase()}...`} />
					<div className={styles.bulkActions}>
						<button type='button' className={styles.bulkAction} onClick={() => setDraft(allValues)}>
							Select all
						</button>
						<button type='button' className={styles.bulkAction} onClick={() => setDraft([])}>
							Deselect all
						</button>
					</div>
					<CommandList className={styles.options}>
						<CommandEmpty className={styles.empty}>No matches</CommandEmpty>
						{options.map((option) => (
							<CommandItem
								key={option.value}
								value={option.label}
								onSelect={() => toggleValue(option.value)}
							>
								<span className={styles.label}>{option.label}</span>
								{typeof option.count === 'number' && (
									<Badge variant='secondary' className={styles.count}>
										{option.count}
									</Badge>
								)}
								<span className={styles.check}>
									{draft.includes(option.value) && <CheckIcon size={16} />}
								</span>
							</CommandItem>
						))}
					</CommandList>
					<div className={styles.apply}>
						<Button size='sm' disabled={!isDirty} onClick={applyDraft}>
							Apply
						</Button>
					</div>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
