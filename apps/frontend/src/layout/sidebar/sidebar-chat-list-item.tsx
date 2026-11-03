import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { EllipsisVertical, Pencil, StarIcon, StarOffIcon, TrashIcon, Upload } from 'lucide-react';
import { useState } from 'react';
import styles from './sidebar-chat-list-item.module.css';
import type { ComponentProps } from 'react';
import type { GroupedChatItem } from '@quarry/shared/types';
import { ShareChatDialog } from '@/components/share-dialog.chat.tsx';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InputEdit } from '@/components/ui/input-edit';
import { Link } from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';

import { Button } from '@/components/ui/button';
import { getOnboardingChatIdStorage } from '@/hooks/use-agent';
import { useChatActivity } from '@/hooks/use-chat-activity';
import { useTimeAgo } from '@/hooks/use-time-ago';
import { useToggleStarred } from '@/hooks/use-toggle-starred';
import { useSession } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { chatApi } from '@/lib/chat-api';

export interface Props extends Omit<ComponentProps<'div'>, 'children'> {
	chat: GroupedChatItem;
}

export function ChatListItem({ chat }: Props) {
	const navigate = useNavigate();
	const { data: session } = useSession();
	const timeAgo = useTimeAgo(chat.updatedAt);
	const activity = useChatActivity(chat.id);
	const toggleStarred = useToggleStarred();
	const [title, setTitle] = useState(chat.title);
	const [isRenaming, setIsRenaming] = useState(false);
	const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

	const deleteChat = useMutation(
		chatApi.chat.delete.mutationOptions({
			onSuccess: (_data, vars, _res, ctx) => {
				if (chat.isOnboarding && session?.user.id) {
					const storage = getOnboardingChatIdStorage(session.user.id);
					if (storage.get() === vars.chatId) {
						storage.set(null);
					}
				}
				setIsDeleteDialogOpen(false);
				navigate({ to: '/' });
				ctx.client.invalidateQueries({ queryKey: [['chat', 'listGrouped']] });
			},
		}),
	);

	const renameChat = useMutation(
		chatApi.chat.rename.mutationOptions({
			onSuccess: (_data, vars, _res, ctx) => {
				ctx.client.setQueryData(chatApi.chat.get.queryKey({ chatId: vars.chatId }), (prev) => {
					if (!prev) {
						return prev;
					}
					return { ...prev, title: vars.title };
				});
				ctx.client.invalidateQueries({ queryKey: [['chat', 'listGrouped']] });
			},
			onSettled: () => {
				setIsRenaming(false);
			},
		}),
	);

	const handleTitleRenameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setTitle(e.target.value);
	};

	const handleTitleRenameSubmit = async () => {
		if (title.trim() && title !== chat.title) {
			await renameChat.mutateAsync({ chatId: chat.id, title: title.trim() });
		} else {
			setIsRenaming(false);
		}
	};

	const handleTitleRenameEscape = () => {
		setTitle(chat.title);
		setIsRenaming(false);
	};

	const handleRenameSelect = () => {
		setIsRenaming(!isRenaming);
	};

	const handleDeleteSelect = () => {
		deleteChat.reset();
		setIsDeleteDialogOpen(true);
	};

	const handleStarSelect = () => {
		toggleStarred.mutate({ chatId: chat.id, isStarred: !chat.isStarred });
	};

	const handleDoubleClick = () => {
		if (!chat.isOnboarding) {
			setIsRenaming(true);
		}
	};

	return (
		<>
			<Link
				params={{ chatId: chat.id }}
				to={`/$chatId`}
				className={cn(`${styles.chatListItemLink} group`, !isRenaming && styles.chatListItemLink2)}
				inactiveProps={{
					className: styles.chatListItemClassName,
				}}
				activeProps={{
					className: styles.chatListItemClassName2,
				}}
				onDoubleClick={handleDoubleClick}
			>
				{isRenaming ? (
					<InputEdit
						value={title}
						onChange={handleTitleRenameChange}
						onSubmit={handleTitleRenameSubmit}
						onEscape={handleTitleRenameEscape}
						disabled={renameChat.isPending}
					/>
				) : (
					<>
						{activity.unread && <span className={styles.chatListItemSpan} />}
						<div className={styles.chatListItemDiv}>{chat.isOnboarding ? 'Project setup' : chat.title}</div>
						{activity.running ? (
							<Spinner className={styles.chatListItemSpinner} />
						) : (
							<div className={styles.chatListItemDiv2}>{timeAgo.humanReadable}</div>
						)}

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant='ghost'
									size='icon-xs'
									className={styles.chatListItemButton}
									onClick={(event) => {
										// Inside the row's link: without this the browser follows it and the menu never shows.
										event.preventDefault();
										event.stopPropagation();
									}}
								>
									<EllipsisVertical />
								</Button>
							</DropdownMenuTrigger>

							<DropdownMenuContent
								className={styles.chatListItemDropdownMenuContent}
								onClick={(e) => e.stopPropagation()}
							>
								<DropdownMenuGroup>
									<DropdownMenuItem onSelect={handleStarSelect}>
										{chat.isStarred ? <StarOffIcon /> : <StarIcon />}
										{chat.isStarred ? 'Unstar' : 'Star'}
									</DropdownMenuItem>
									{!chat.isOnboarding && (
										<DropdownMenuItem onSelect={handleRenameSelect}>
											<Pencil />
											Rename
										</DropdownMenuItem>
									)}
									<DropdownMenuItem onSelect={() => setIsShareDialogOpen(true)}>
										<Upload />
										Share
									</DropdownMenuItem>
									<DropdownMenuItem variant='destructive' onSelect={handleDeleteSelect}>
										<TrashIcon />
										Delete
									</DropdownMenuItem>
								</DropdownMenuGroup>
							</DropdownMenuContent>
						</DropdownMenu>
					</>
				)}
			</Link>

			<ShareChatDialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen} chatId={chat.id} />
			<ConfirmationDialog
				open={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
				title='Delete this chat?'
				description={`"${chat.title}" will be permanently deleted. Any stories created in this chat will be deleted too, including for people they are shared with. This cannot be undone.`}
				confirmLabel='Delete chat and stories'
				onConfirm={() => deleteChat.mutate({ chatId: chat.id })}
				isPending={deleteChat.isPending}
				error={deleteChat.error?.message}
				preventCloseWhilePending
			/>
		</>
	);
}
