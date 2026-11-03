import { useMutation } from '@apollo/client/react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import styles from './create-project-dialog.module.css';
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
import { CreateProjectDocument } from '@/graphql/generated/graphql';
import { setActiveProjectId } from '@/lib/active-project';
import { apolloClient } from '@/lib/apollo-client';

interface CreateProjectDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/** loopwise: creates a project (its own context folder), selects it and opens its warehouse settings. */
export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
	const [name, setName] = useState('');
	const [createProject, { loading, error, reset }] = useMutation(CreateProjectDocument);
	const queryClient = useQueryClient();
	const router = useRouter();
	const navigate = useNavigate();

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setName('');
			reset();
		}
		onOpenChange(next);
	};

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		const result = await createProject({ variables: { input: { name: name.trim() } } }).catch(() => null);
		const project = result?.data?.createProject;
		if (!project) {
			return;
		}
		setActiveProjectId(project.id);
		await Promise.all([apolloClient.resetStore(), queryClient.invalidateQueries(), router.invalidate()]);
		handleOpenChange(false);
		await navigate({ to: '/settings/project' });
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<form onSubmit={handleSubmit} className={styles.createProjectDialogForm}>
					<DialogHeader>
						<DialogTitle>New project</DialogTitle>
						<DialogDescription>
							A project has its own warehouse connection, context and chats.
						</DialogDescription>
					</DialogHeader>
					<Input
						autoFocus
						placeholder='Project name'
						value={name}
						maxLength={100}
						onChange={(event) => setName(event.target.value)}
						aria-label='Project name'
					/>
					{error && <p className={styles.createProjectDialogP}>{error.message}</p>}
					<DialogFooter>
						<Button type='button' variant='ghost' onClick={() => handleOpenChange(false)}>
							Cancel
						</Button>
						<Button type='submit' disabled={!name.trim() || loading}>
							{loading ? 'Creating…' : 'Create project'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
