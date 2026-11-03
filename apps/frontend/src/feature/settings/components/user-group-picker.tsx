import { ChevronDown } from 'lucide-react';

import { ResponsiveGroupChips } from './user-group-chips';
import styles from './user-group-picker.module.css';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface UserGroupPickerOption {
	id: string;
	name: string;
	isDefault: boolean;
}

export function UserGroupPicker({
	groups,
	selectedGroupIds,
	loading = false,
	compact = false,
	onSelectedGroupIdsChange,
}: {
	groups: UserGroupPickerOption[];
	selectedGroupIds: string[];
	loading?: boolean;
	compact?: boolean;
	onSelectedGroupIdsChange: (groupIds: string[]) => void;
}) {
	const defaultGroup = groups.find((group) => group.isDefault);
	const selectableGroups = groups.filter((group) => !group.isDefault);
	const selectedGroupNames = selectableGroups
		.filter((group) => selectedGroupIds.includes(group.id))
		.map((group) => group.name);
	const chipNames = [defaultGroup?.name ?? 'All Users', ...selectedGroupNames];

	const toggleGroup = (groupId: string, selected: boolean) => {
		onSelectedGroupIdsChange(
			selected ? [...selectedGroupIds, groupId] : selectedGroupIds.filter((selectedId) => selectedId !== groupId),
		);
	};

	const picker = (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type='button'
					variant='outline'
					size={compact ? 'sm' : 'default'}
					className={cn(styles.pickerButton, compact ? styles.pickerButton2 : styles.pickerButton3)}
					aria-label={`Select user groups. Current groups: ${chipNames.join(', ')}`}
					disabled={loading}
				>
					<ResponsiveGroupChips names={chipNames} size={compact ? 'compact' : 'default'} />
					<ChevronDown className={cn(styles.pickerChevronDown, compact && styles.pickerChevronDown2)} />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='start' className={styles.pickerDropdownMenuContent}>
				<DropdownMenuCheckboxItem checked disabled>
					{defaultGroup?.name ?? 'All Users'} (automatic)
				</DropdownMenuCheckboxItem>
				{selectableGroups.map((group) => (
					<DropdownMenuCheckboxItem
						key={group.id}
						checked={selectedGroupIds.includes(group.id)}
						onSelect={(event) => event.preventDefault()}
						onCheckedChange={(checked) => toggleGroup(group.id, checked === true)}
					>
						{group.name}
					</DropdownMenuCheckboxItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);

	if (compact) {
		return picker;
	}

	return (
		<div className={styles.userGroupPickerDiv}>
			<label className={styles.userGroupPickerLabel}>Groups</label>
			{picker}
			<p className={styles.userGroupPickerP}>
				{loading ? 'Loading groups...' : `${defaultGroup?.name ?? 'All Users'} is added automatically.`}
			</p>
		</div>
	);
}
