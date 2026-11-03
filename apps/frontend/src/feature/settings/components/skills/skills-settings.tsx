import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { SkillFormDialog } from './skill-form-dialog';
import styles from './skills-settings.module.css';
import type { SkillDraft } from '@quarry/shared/skill-authoring';

import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Empty } from '@/components/ui/empty';
import { ErrorMessage } from '@/components/ui/error-message';
import { SettingsCard } from '@/components/ui/settings-card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/use-permissions';
import { skillApi } from '@/lib/skill-api';

const EMPTY_DRAFT: SkillDraft = { name: '', description: '', body: '' };

/** Settings → Project → Skills: the project's skills, and writing new ones without touching files. */
export function SkillsSettings() {
	const { isAdmin, isContextAdmin } = usePermissions();
	if (!isAdmin && !isContextAdmin) {
		return (
			<SettingsCard>
				<Empty>Only project admins can manage skills. You can use them with / in chat.</Empty>
			</SettingsCard>
		);
	}
	return <SkillsManager />;
}

function SkillsManager() {
	const queryClient = useQueryClient();
	const catalog = useQuery(skillApi.skill.catalog.queryOptions());
	const loadErrors = useQuery(skillApi.skill.listLoadErrors.queryOptions());
	const status = useQuery(skillApi.skill.saveStatus.queryOptions());
	const [isCreating, setIsCreating] = useState(false);
	const [editingName, setEditingName] = useState<string | null>(null);
	const [deletingName, setDeletingName] = useState<string | null>(null);

	const refresh = () =>
		Promise.all(
			[skillApi.skill.catalog, skillApi.skill.list, skillApi.skill.listLoadErrors].map((procedure) =>
				queryClient.invalidateQueries({ queryKey: procedure.queryKey() }),
			),
		);
	const createMutation = useMutation(skillApi.skill.create.mutationOptions({ onSuccess: refresh }));
	const updateMutation = useMutation(skillApi.skill.update.mutationOptions({ onSuccess: refresh }));
	const deleteMutation = useMutation(skillApi.skill.delete.mutationOptions({ onSuccess: refresh }));
	const editing = useQuery(
		skillApi.skill.detail.queryOptions(editingName ? { name: editingName } : skipToken, { gcTime: 0 }),
	);

	const mode = status.data?.mode;
	const canCreate = mode === 'direct';
	const create = (draft: SkillDraft) => {
		createMutation.mutate(draft, {
			onSuccess: () => {
				setIsCreating(false);
			},
		});
	};
	const confirmDelete = async () => {
		if (!deletingName) {
			return;
		}
		const { hash } = await queryClient.fetchQuery(skillApi.skill.detail.queryOptions({ name: deletingName }));
		await deleteMutation.mutateAsync({ name: deletingName, expectedHash: hash });
		setDeletingName(null);
	};

	return (
		<SettingsCard
			title='Project skills'
			description='Each skill is a Markdown file in agent/skills/.'
			action={
				canCreate && (
					<Button
						size='sm'
						onClick={() => {
							createMutation.reset();
							setIsCreating(true);
						}}
					>
						<Plus />
						New skill
					</Button>
				)
			}
			divide
		>
			{status.data?.message && (
				<div className={styles.skillNotice} data-testid='skill-save-blocked'>
					<span>{status.data.message}</span>
				</div>
			)}
			{loadErrors.data?.map((error) => (
				<ErrorMessage key={error.location} message={`${error.location}: ${error.message}`} />
			))}

			{catalog.isLoading ? (
				<Skeleton className={styles.skillSkeleton} />
			) : catalog.isError ? (
				<ErrorMessage message={catalog.error.message} />
			) : !catalog.data?.length ? (
				<Empty>No skills yet. Add one, or ask the agent in chat to turn an analysis into a skill.</Empty>
			) : (
				<div className={styles.skillList}>
					{catalog.data.map((skill) => (
						<div key={skill.name} className={styles.skillRow}>
							<BookOpen className={styles.skillIcon} />
							<div className={styles.skillText}>
								<span className={styles.skillName}>/{skill.name}</span>
								<p className={styles.skillHint}>{skill.description}</p>
							</div>
							{mode === 'direct' && (
								<>
									<Button
										variant='ghost-muted'
										size='icon-sm'
										onClick={() => {
											updateMutation.reset();
											setEditingName(skill.name);
										}}
										aria-label={`Edit ${skill.name}`}
									>
										<Pencil />
									</Button>
									<Button
										variant='ghost-muted'
										size='icon-sm'
										onClick={() => {
											deleteMutation.reset();
											setDeletingName(skill.name);
										}}
										aria-label={`Delete ${skill.name}`}
									>
										<Trash2 />
									</Button>
								</>
							)}
						</div>
					))}
				</div>
			)}

			{isCreating && (
				<SkillFormDialog
					title='New skill'
					initial={EMPTY_DRAFT}
					isPending={createMutation.isPending}
					error={createMutation.error?.message}
					onClose={() => setIsCreating(false)}
					onSubmit={create}
				/>
			)}
			{editingName && editing.isError && <ErrorMessage message={editing.error.message} />}
			{editingName && editing.data && (
				<SkillFormDialog
					key={editing.data.hash}
					title={`Edit ${editingName}`}
					initial={editing.data}
					isEditing
					isPending={updateMutation.isPending}
					error={updateMutation.error?.message}
					onClose={() => setEditingName(null)}
					onSubmit={(draft) =>
						editing.data &&
						updateMutation.mutate(
							{ ...draft, expectedHash: editing.data.hash },
							{ onSuccess: () => setEditingName(null) },
						)
					}
				/>
			)}
			<ConfirmationDialog
				open={!!deletingName}
				onOpenChange={(open) => !open && setDeletingName(null)}
				title='Delete skill?'
				description={`The agent and / in chat will no longer offer ${deletingName ?? 'this skill'}. Without a context repository, this can't be undone.`}
				confirmLabel='Delete'
				onConfirm={() => confirmDelete().catch(() => undefined)}
				isPending={deleteMutation.isPending}
				error={deleteMutation.error?.message}
			/>
		</SettingsCard>
	);
}
