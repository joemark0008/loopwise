import { useMutation } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useMutation as useApolloMutation } from '@apollo/client/react';
import styles from './editable-project-name.module.css';
import type { KeyboardEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { refetchProjectQueries } from '@/hooks/use-current-project';
import { RenameProjectDocument } from '@/graphql/generated/graphql';

interface EditableProjectNameProps {
	projectId: string;
	name: string;
	canEdit: boolean;
}

export function EditableProjectName({ projectId, name, canEdit }: EditableProjectNameProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(name);
	const [renameProject] = useApolloMutation(RenameProjectDocument);
	const rename = useMutation({
		mutationFn: (input: { projectId: string; name: string }) => renameProject({ variables: { input } }),
		onSuccess: () => refetchProjectQueries(),
	});

	useEffect(() => {
		if (isEditing) {
			inputRef.current?.focus();
			inputRef.current?.select();
		}
	}, [isEditing]);

	const startEditing = () => {
		setDraft(name);
		setIsEditing(true);
	};

	const submit = () => {
		const nextName = draft.trim();
		setIsEditing(false);
		if (nextName && nextName !== name) {
			rename.mutate({ projectId, name: nextName });
		}
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'Enter') {
			event.preventDefault();
			submit();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			setIsEditing(false);
		}
	};

	if (isEditing) {
		return (
			<Input
				ref={inputRef}
				value={draft}
				maxLength={100}
				aria-label='Project name'
				onChange={(event) => setDraft(event.target.value)}
				onBlur={submit}
				onKeyDown={handleKeyDown}
				disabled={rename.isPending}
				className={styles.editableProjectNameInput}
			/>
		);
	}

	return (
		<div className={styles.editableProjectNameDiv}>
			<div className={styles.editableProjectNameDiv2}>
				<span>{rename.isPending ? rename.variables.name : name}</span>
				{canEdit && (
					<Button
						variant='ghost'
						size='icon-sm'
						aria-label='Rename project'
						onClick={startEditing}
						disabled={rename.isPending}
					>
						<Pencil className={styles.editableProjectNamePencil} />
					</Button>
				)}
			</div>
			{rename.isError && <span className={styles.editableProjectNameSpan}>{rename.error.message}</span>}
		</div>
	);
}
