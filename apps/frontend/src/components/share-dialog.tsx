import { Check, Globe, Link as LinkIcon, Loader2, SearchIcon, Unlink, Users } from 'lucide-react';

import styles from './share-dialog.module.css';
import type { Visibility } from '@quarry/shared/types';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export function ShareLoadingDialog({
	open,
	onOpenChange,
	title,
	className = styles.state100,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	className?: string;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className={className}>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>Loading sharing settings...</DialogDescription>
				</DialogHeader>
				<div className={styles.shareLoadingDialogDiv}>
					<Loader2 className={styles.shareLoadingDialogLoader2} />
				</div>
			</DialogContent>
		</Dialog>
	);
}

export function ShareErrorDialog({
	open,
	onOpenChange,
	title,
	onRetry,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	onRetry: () => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className={styles.shareErrorDialogDialogContent}>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription className={styles.shareErrorDialogDialogDescription}>
						Failed to load sharing settings. Please try again.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant='outline' onClick={() => onOpenChange(false)}>
						Close
					</Button>
					<Button onClick={onRetry}>Retry</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function VisibilityPicker({
	visibility,
	onChange,
	specificLabel = 'Specific people',
	canShareToProject = true,
}: {
	visibility: Visibility;
	onChange: (v: Visibility) => void;
	specificLabel?: string;
	canShareToProject?: boolean;
}) {
	if (!canShareToProject) {
		return null;
	}
	return (
		<div className={styles.visibilityPickerDiv}>
			<VisibilityOption
				active={visibility === 'project'}
				icon={<Globe className={styles.visibilityPickerGlobe} />}
				label='Entire project'
				description='All project members'
				onClick={() => onChange('project')}
			/>
			<VisibilityOption
				active={visibility === 'specific'}
				icon={<Users className={styles.visibilityPickerGlobe} />}
				label={specificLabel}
				description='Choose who can view'
				onClick={() => onChange('specific')}
			/>
		</div>
	);
}

export function NotifyPeopleToggle({
	checked,
	onCheckedChange,
	itemLabel,
}: {
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	itemLabel: string;
}) {
	return (
		<div className={styles.notifyPeopleToggleDiv}>
			<div className={styles.notifyPeopleToggleDiv2}>
				<label htmlFor='notify-people' className={`${styles.notifyPeopleToggleLabel} text-md`}>
					Notify people
				</label>
				<p className={styles.notifyPeopleToggleP}>Send an email letting them know about this {itemLabel}</p>
			</div>
			<Switch id='notify-people' checked={checked} onCheckedChange={onCheckedChange} />
		</div>
	);
}

export function VisibilitySummary({
	visibility,
	selectedUserIds,
	selectedGroupIds,
	itemLabel,
}: {
	visibility: Visibility;
	selectedUserIds: Set<string>;
	selectedGroupIds?: Set<string>;
	itemLabel: string;
}) {
	return (
		<div className={styles.visibilitySummaryDiv}>
			{visibility === 'project' ? (
				<>
					<div className={styles.visibilitySummaryDiv2}>
						<Globe className={styles.visibilitySummaryGlobe} />
					</div>
					<div className={styles.visibilitySummaryDiv3}>
						<p className={`${styles.notifyPeopleToggleLabel} text-md`}>Shared with entire project</p>
						<p className={styles.notifyPeopleToggleP}>All project members can view this {itemLabel}</p>
					</div>
				</>
			) : (
				<>
					<div className={styles.visibilitySummaryDiv2}>
						<Users className={styles.visibilitySummaryGlobe} />
					</div>
					<div className={styles.visibilitySummaryDiv3}>
						<p className={`${styles.notifyPeopleToggleLabel} text-md`}>
							Shared with {formatRecipientCount(selectedUserIds.size, selectedGroupIds?.size ?? 0)}
						</p>
						<p className={styles.notifyPeopleToggleP}>Only selected members can view this {itemLabel}</p>
					</div>
				</>
			)}
		</div>
	);
}

export function ManageShareFooter({
	isBusy,
	hasChanges,
	isDeletePending,
	isUpdatePending,
	isCopied,
	canSave,
	onUnshare,
	onSaveAccess,
	onCopyLink,
}: {
	isBusy: boolean;
	hasChanges: boolean;
	isDeletePending: boolean;
	isUpdatePending: boolean;
	isCopied: boolean;
	canSave: boolean;
	onUnshare: () => void;
	onSaveAccess: () => void;
	onCopyLink: () => void;
}) {
	return (
		<DialogFooter className={styles.manageShareFooterDialogFooter}>
			<Button variant='outline' onClick={onUnshare} disabled={isBusy} className={styles.manageShareFooterButton}>
				{isDeletePending ? (
					<Loader2 className={styles.manageShareFooterLoader2} />
				) : (
					<Unlink className={styles.manageShareFooterUnlink} />
				)}
				<span>Unshare</span>
			</Button>
			<div className={styles.manageShareFooterDiv}>
				{hasChanges && (
					<Button
						onClick={onSaveAccess}
						disabled={isBusy || !canSave}
						className={styles.manageShareFooterButton2}
					>
						{isUpdatePending ? (
							<Loader2 className={styles.manageShareFooterLoader2} />
						) : (
							<Check className={styles.manageShareFooterUnlink} />
						)}
						<span>Save</span>
					</Button>
				)}
				<Button variant='outline' onClick={onCopyLink} className={styles.manageShareFooterButton2}>
					{isCopied ? (
						<Check className={styles.manageShareFooterUnlink} />
					) : (
						<LinkIcon className={styles.manageShareFooterUnlink} />
					)}
					<span>{isCopied ? 'Copied!' : 'Copy link'}</span>
				</Button>
			</div>
		</DialogFooter>
	);
}

export function VisibilityOption({
	active,
	icon,
	label,
	description,
	onClick,
}: {
	active: boolean;
	icon: React.ReactNode;
	label: string;
	description: string;
	onClick: () => void;
}) {
	return (
		<button
			type='button'
			onClick={onClick}
			className={cn(
				styles.visibilityOptionButton,
				active ? styles.visibilityOptionButton2 : styles.visibilityOptionButton3,
			)}
		>
			<div className={styles.visibilityOptionDiv}>{icon}</div>
			<span className={`${styles.visibilityOptionSpan} text-md`}>{label}</span>
			<span className={styles.notifyPeopleToggleP}>{description}</span>
		</button>
	);
}

export interface ShareableGroup {
	id: string;
	name: string;
	memberCount: number;
}

export function MemberPicker({
	members,
	selectedUserIds,
	isLoading,
	search,
	onSearchChange,
	onToggleUser,
	groups = [],
	selectedGroupIds = new Set(),
	onToggleGroup,
	emptyMessage = 'No other members in this project',
}: {
	members: { id: string; name: string; email: string }[];
	selectedUserIds: Set<string>;
	isLoading: boolean;
	search: string;
	onSearchChange: (value: string) => void;
	onToggleUser: (userId: string) => void;
	groups?: ShareableGroup[];
	selectedGroupIds?: Set<string>;
	onToggleGroup?: (groupId: string) => void;
	emptyMessage?: string;
}) {
	const showGroups = onToggleGroup !== undefined && groups.length > 0;
	const hasResults = members.length > 0 || showGroups;
	const selectedCount = selectedUserIds.size + selectedGroupIds.size;

	return (
		<div className={styles.memberPickerDiv}>
			<SearchIcon className={styles.memberPickerSearchIcon} />
			<Input
				type='search'
				placeholder={onToggleGroup ? 'Search members or groups...' : 'Search members...'}
				value={search}
				onChange={(e) => onSearchChange(e.target.value)}
				className={styles.memberPickerInput}
			/>
			<div className={styles.memberPickerDiv2}>
				{isLoading ? (
					<div className={styles.shareLoadingDialogDiv}>
						<Loader2 className={styles.shareLoadingDialogLoader2} />
					</div>
				) : !hasResults ? (
					<div className={styles.memberPickerDiv3}>{search ? 'No members found' : emptyMessage}</div>
				) : (
					<>
						{showGroups && (
							<>
								<PickerSectionLabel>Groups</PickerSectionLabel>
								{groups.map((group) => (
									<GroupRow
										key={group.id}
										name={group.name}
										memberCount={group.memberCount}
										selected={selectedGroupIds.has(group.id)}
										onClick={() => onToggleGroup(group.id)}
									/>
								))}
								{members.length > 0 && <PickerSectionLabel>People</PickerSectionLabel>}
							</>
						)}
						{members.map((member) => (
							<MemberRow
								key={member.id}
								name={member.name}
								email={member.email}
								selected={selectedUserIds.has(member.id)}
								onClick={() => onToggleUser(member.id)}
							/>
						))}
					</>
				)}
			</div>
			{selectedCount > 0 && (
				<p className={styles.notifyPeopleToggleP}>
					{formatRecipientCount(selectedUserIds.size, selectedGroupIds.size)} selected
				</p>
			)}
		</div>
	);
}

export function MemberRow({
	name,
	email,
	selected,
	onClick,
}: {
	name: string;
	email: string;
	selected: boolean;
	onClick: () => void;
}) {
	return (
		<PickerRow selected={selected} onClick={onClick}>
			<Avatar username={name} size='sm' />
			<div className={styles.visibilitySummaryDiv3}>
				<div className={styles.memberRowDiv}>{name}</div>
				<div className={styles.memberRowDiv2}>{email}</div>
			</div>
		</PickerRow>
	);
}

function GroupRow({
	name,
	memberCount,
	selected,
	onClick,
}: {
	name: string;
	memberCount: number;
	selected: boolean;
	onClick: () => void;
}) {
	return (
		<PickerRow selected={selected} onClick={onClick}>
			<div className={styles.groupRowDiv}>
				<Users className={styles.manageShareFooterUnlink} />
			</div>
			<div className={styles.visibilitySummaryDiv3}>
				<div className={styles.memberRowDiv}>{name}</div>
				<div className={styles.memberRowDiv2}>
					{memberCount} {memberCount === 1 ? 'member' : 'members'}
				</div>
			</div>
		</PickerRow>
	);
}

function PickerRow({
	selected,
	onClick,
	children,
}: {
	selected: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type='button'
			onClick={onClick}
			aria-pressed={selected}
			className={cn(styles.pickerRowButton, styles.pickerRowButton2)}
		>
			{children}
			<div className={cn(styles.pickerRowDiv, selected ? styles.pickerRowDiv2 : styles.pickerRowDiv3)}>
				{selected && <Check className={styles.pickerRowCheck} />}
			</div>
		</button>
	);
}

function PickerSectionLabel({ children }: { children: React.ReactNode }) {
	return <div className={styles.pickerSectionLabelDiv}>{children}</div>;
}

export function hasAccessChanges(
	visibility: Visibility,
	allowedUserIds: string[],
	selectedUserIds: Set<string>,
	allowedGroupIds: string[] = [],
	selectedGroupIds: Set<string> = new Set(),
): boolean {
	if (visibility !== 'specific') {
		return false;
	}
	return (
		!isSameSet(new Set(allowedUserIds), selectedUserIds) || !isSameSet(new Set(allowedGroupIds), selectedGroupIds)
	);
}

function isSameSet(left: Set<string>, right: Set<string>): boolean {
	if (left.size !== right.size) {
		return false;
	}
	for (const id of right) {
		if (!left.has(id)) {
			return false;
		}
	}
	return true;
}

function formatRecipientCount(peopleCount: number, groupCount: number): string {
	const people = `${peopleCount} ${peopleCount === 1 ? 'person' : 'people'}`;
	if (groupCount === 0) {
		return people;
	}
	const groups = `${groupCount} ${groupCount === 1 ? 'group' : 'groups'}`;
	return peopleCount === 0 ? groups : `${people} and ${groups}`;
}
