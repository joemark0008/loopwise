import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { SettingsMemoryItem, SettingsMemorySkeleton } from './memory-item';
import styles from './memories.module.css';
import type { UserMemoryRecord } from '@loopwise/api/agent/types/memory';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty } from '@/components/ui/empty';
import { ErrorMessage } from '@/components/ui/error-message';
import { SettingsCard } from '@/components/ui/settings-card';
import { SettingsControlRow } from '@/components/ui/settings-toggle-row';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useMemoriesQuery, useMemoryMutations, useMemorySettingsQuery } from '@/queries/use-memories';
import { memoryApi } from '@/lib/memory-api';

export function SettingsMemories({ isAdmin }: { isAdmin: boolean }) {
	const projectMemorySettings = useQuery(memoryApi.project.getMemorySettings.queryOptions());
	const memorySettings = useMemorySettingsQuery();

	const { updateMemorySettingsMutation, updateMutation, deleteMutation } = useMemoryMutations();

	const projectMemoryEnabled = projectMemorySettings.data?.memoryEnabled ?? true;
	const userMemoryEnabled = memorySettings.data?.memoryEnabled ?? true;
	const isProjectDisabled = !projectMemoryEnabled;
	const isUserDisabled = !userMemoryEnabled;
	const canShowMemories = !isProjectDisabled && !isUserDisabled;

	const { data: memories, isLoading: isMemoriesLoading } = useMemoriesQuery(canShowMemories);

	const [editMemory, setEditMemory] = useState<UserMemoryRecord | null>(null);
	const [editContent, setEditContent] = useState('');
	const [deleteMemory, setDeleteMemory] = useState<UserMemoryRecord | null>(null);

	const isUserToggleDisabled = isProjectDisabled || updateMemorySettingsMutation.isPending;

	const memoryStatusMessage = useMemo(() => {
		if (isProjectDisabled) {
			return {
				toggle: isAdmin
					? 'Turned off for the whole project.'
					: 'An admin has turned memory off for this project.',
				empty: isAdmin
					? 'Turn on project memory in Agent → Capabilities to see and use your saved memories.'
					: 'Ask an admin to turn on project memory to see and use your saved memories.',
			};
		}
		if (isUserDisabled) {
			return {
				toggle: '',
				empty: 'Turn on memory for yourself to see and use your saved memories.',
			};
		}
		return null;
	}, [isAdmin, isProjectDisabled, isUserDisabled]);

	const handleUserToggle = (enabled: boolean) => {
		updateMemorySettingsMutation.mutate({ memoryEnabled: enabled });
	};

	const handleEditMemory = (memory: UserMemoryRecord) => {
		setEditMemory(memory);
		setEditContent(memory.content);
	};

	const handleDeleteMemory = (memory: UserMemoryRecord) => {
		setDeleteMemory(memory);
	};

	const handleSaveEdit = async () => {
		if (!editMemory) {
			return;
		}
		await updateMutation.mutateAsync({
			memoryId: editMemory.id,
			content: editContent,
		});
		setEditMemory(null);
	};

	const handleConfirmDelete = () => {
		if (!deleteMemory) {
			return;
		}
		deleteMutation.mutate({ memoryId: deleteMemory.id });
	};

	return (
		<SettingsCard
			title='Your memory'
			description='What Loopwise remembers about you. Only you can see and manage these.'
			divide
		>
			<SettingsControlRow
				id='user-memory'
				label='Enable memory for me'
				description={
					isProjectDisabled
						? memoryStatusMessage?.toggle
						: 'Allow Loopwise to save and use memories about you.'
				}
				control={
					<Switch
						id='user-memory'
						checked={userMemoryEnabled}
						onCheckedChange={handleUserToggle}
						disabled={isUserToggleDisabled}
					/>
				}
			/>
			{memoryStatusMessage ? (
				<div className={styles.settingsMemoriesDiv}>
					<Empty>{memoryStatusMessage.empty}</Empty>
				</div>
			) : isMemoriesLoading ? (
				<div className={styles.settingsMemoriesDiv2}>
					<SettingsMemorySkeleton className={styles.settingsMemoriesSettingsMemorySkeleton} />
					<SettingsMemorySkeleton />
					<SettingsMemorySkeleton className={styles.settingsMemoriesSettingsMemorySkeleton2} />
				</div>
			) : !memories?.length ? (
				<Empty>No memories saved yet.</Empty>
			) : (
				<div className={styles.settingsMemoriesDiv2}>
					{memories.map((memory) => (
						<SettingsMemoryItem
							key={memory.id}
							memory={memory}
							className={styles.settingsMemoriesSettingsMemoryItem}
							onEdit={handleEditMemory}
							onDelete={handleDeleteMemory}
						/>
					))}
				</div>
			)}

			<Dialog open={!!editMemory} onOpenChange={() => setEditMemory(null)}>
				<DialogContent className={styles.settingsMemoriesDialogContent} showCloseButton={false}>
					<DialogHeader>
						<DialogTitle>Edit memory</DialogTitle>
					</DialogHeader>
					<div className={styles.settingsMemoriesDiv3}>
						<Textarea
							value={editContent}
							onChange={(event) => setEditContent(event.target.value)}
							rows={4}
						/>
						{updateMutation.error?.message && <ErrorMessage message={updateMutation.error.message} />}
					</div>
					<DialogFooter>
						<Button variant='ghost' onClick={() => setEditMemory(null)} disabled={updateMutation.isPending}>
							Cancel
						</Button>
						<Button
							onClick={handleSaveEdit}
							disabled={updateMutation.isPending || editContent.trim().length === 0}
						>
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog open={!!deleteMemory} onOpenChange={() => setDeleteMemory(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete memory?</AlertDialogTitle>
						<AlertDialogDescription>
							This memory will be removed and forgotten by the agent.
						</AlertDialogDescription>
					</AlertDialogHeader>
					{deleteMutation.error?.message && <ErrorMessage message={deleteMutation.error.message} />}
					<AlertDialogFooter>
						<AlertDialogCancel variant='outline' size='sm' disabled={deleteMutation.isPending}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							variant='destructive'
							size='sm'
							onClick={handleConfirmDelete}
							disabled={deleteMutation.isPending}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</SettingsCard>
	);
}
