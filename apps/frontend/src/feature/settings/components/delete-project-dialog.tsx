import { useMutation } from '@apollo/client/react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import styles from './delete-project-dialog.module.css';
import type { FormEvent } from 'react';

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
import { DeleteProjectDocument } from '@/graphql/generated/graphql';
import { setActiveProjectId } from '@/lib/active-project';
import { apolloClient } from '@/lib/apollo-client';

interface DeleteProjectDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectId: string;
	projectName: string;
}

/** quarry: deletes the project once its name is typed back, then falls back to another project. */
export function DeleteProjectDialog({ open, onOpenChange, projectId, projectName }: DeleteProjectDialogProps) {
	const [confirmation, setConfirmation] = useState('');
	const [deleteProject, { loading, error, reset }] = useMutation(DeleteProjectDocument);
	const queryClient = useQueryClient();
	const router = useRouter();
	const navigate = useNavigate();
	const canDelete = confirmation === projectName && !loading;

	const handleOpenChange = (next: boolean) => {
		if (!next && loading) {
			return;
		}
		if (!next) {
			setConfirmation('');
			reset();
		}
		onOpenChange(next);
	};

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		if (!canDelete) {
			return;
		}
		const result = await deleteProject({ variables: { projectId } }).catch(() => null);
		if (!result?.data?.deleteProject) {
			return;
		}
		// The API selects the user's next project when none is selected.
		setActiveProjectId(null);
		await Promise.all([apolloClient.resetStore(), queryClient.invalidateQueries(), router.invalidate()]);
		onOpenChange(false);
		await navigate({ to: '/' });
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<form onSubmit={handleSubmit} className={styles.deleteProjectDialogForm}>
					<DialogHeader>
						<DialogTitle>Delete project</DialogTitle>
						<DialogDescription>
							This permanently deletes <strong>{projectName}</strong>, its chats, stories and settings.
							This cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<label className={styles.deleteProjectDialogLabel}>
						<span>
							Type <strong>{projectName}</strong> to confirm.
						</span>
						<Input
							autoFocus
							autoComplete='off'
							value={confirmation}
							onChange={(event) => setConfirmation(event.target.value)}
							aria-label='Project name confirmation'
							disabled={loading}
						/>
					</label>
					{error && <p className={styles.deleteProjectDialogP}>{error.message}</p>}
					<DialogFooter>
						<Button
							type='button'
							variant='ghost'
							disabled={loading}
							onClick={() => handleOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type='submit' variant='destructive' disabled={!canDelete} isLoading={loading}>
							Delete project
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
