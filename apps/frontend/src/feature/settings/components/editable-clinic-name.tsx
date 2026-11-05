import { useMutation } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useMutation as useApolloMutation } from '@apollo/client/react';
import styles from './editable-clinic-name.module.css';
import type { KeyboardEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { refetchClinicQueries } from '@/hooks/use-current-clinic';
import { RenameClinicDocument } from '@/graphql/generated/graphql';

interface EditableClinicNameProps {
	clinicId: string;
	name: string;
	canEdit: boolean;
}

export function EditableClinicName({ clinicId, name, canEdit }: EditableClinicNameProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(name);
	const [renameClinic] = useApolloMutation(RenameClinicDocument);
	const rename = useMutation({
		mutationFn: (input: { clinicId: string; name: string }) => renameClinic({ variables: { input } }),
		onSuccess: () => refetchClinicQueries(),
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
			rename.mutate({ clinicId, name: nextName });
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
				aria-label='Clinic name'
				onChange={(event) => setDraft(event.target.value)}
				onBlur={submit}
				onKeyDown={handleKeyDown}
				disabled={rename.isPending}
				className={styles.editableClinicNameInput}
			/>
		);
	}

	return (
		<div className={styles.editableClinicNameDiv}>
			<div className={styles.editableClinicNameDiv2}>
				<span>{rename.isPending ? rename.variables.name : name}</span>
				{canEdit && (
					<Button
						variant='ghost'
						size='icon-sm'
						aria-label='Rename clinic'
						onClick={startEditing}
						disabled={rename.isPending}
					>
						<Pencil className={styles.editableClinicNamePencil} />
					</Button>
				)}
			</div>
			{rename.isError && <span className={styles.editableClinicNameSpan}>{rename.error.message}</span>}
		</div>
	);
}
