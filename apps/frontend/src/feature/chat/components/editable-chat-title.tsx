import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import styles from './editable-chat-title.module.css';
import { cn } from '@/lib/utils';
import { chatApi } from '@/lib/chat-api';

interface Props {
	chatId: string;
	title: string;
	className?: string;
}

export function EditableChatTitle({ chatId, title: currentTitle, className }: Props) {
	const inputRef = useRef<HTMLInputElement>(null);
	const submittingRef = useRef(false);
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(currentTitle);

	const renameChat = useMutation(
		chatApi.chat.rename.mutationOptions({
			onSuccess: (_data, vars, _res, ctx) => {
				ctx.client.setQueryData(chatApi.chat.get.queryKey({ chatId }), (prev) => {
					if (!prev) {
						return prev;
					}
					return { ...prev, title: vars.title };
				});
				ctx.client.invalidateQueries({ queryKey: [['chat', 'listGrouped']] });
			},
			onSettled: () => {
				setIsEditing(false);
			},
		}),
	);

	const startEditing = () => {
		setDraft(currentTitle);
		setIsEditing(true);
		requestAnimationFrame(() => {
			inputRef.current?.focus();
			inputRef.current?.select();
		});
	};

	const submit = async () => {
		if (!isEditing || submittingRef.current) {
			return;
		}
		const trimmed = draft.trim();
		if (trimmed && trimmed !== currentTitle) {
			submittingRef.current = true;
			try {
				await renameChat.mutateAsync({ chatId, title: trimmed });
			} finally {
				submittingRef.current = false;
			}
		} else {
			setDraft(currentTitle);
			setIsEditing(false);
		}
	};

	const cancel = () => {
		setDraft(currentTitle);
		setIsEditing(false);
	};

	return (
		<input
			ref={inputRef}
			value={isEditing ? draft : currentTitle}
			readOnly={!isEditing}
			onChange={(e) => setDraft(e.target.value)}
			onClick={() => !isEditing && startEditing()}
			onKeyDown={(e) => {
				if (e.key === 'Enter') {
					submit();
				} else if (e.key === 'Escape') {
					cancel();
				}
			}}
			onBlur={submit}
			disabled={renameChat.isPending}
			className={cn(
				styles.editableChatTitleInput,
				styles.editableChatTitleInput2,
				styles.editableChatTitleInput3,
				!isEditing && styles.editableChatTitleInput4,
				isEditing && styles.editableChatTitleInput5,
				className,
			)}
		/>
	);
}
