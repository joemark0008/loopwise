import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Link as LinkIcon, Loader2 } from 'lucide-react';
import styles from './share-dialog.chat.module.css';
import type { Visibility } from '@quarry/shared/types';
import {
	hasAccessChanges,
	ManageShareFooter,
	MemberPicker,
	NotifyPeopleToggle,
	ShareErrorDialog,
	ShareLoadingDialog,
	VisibilityPicker,
	VisibilitySummary,
} from '@/components/share-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSession } from '@/lib/auth-client';
import { useMemberPicker, useCopyWithFeedback, useShareAudience } from '@/hooks/use-share-dialog';
import { useSmtpSetup } from '@/hooks/use-public-config';
import { chatApi } from '@/lib/chat-api';

interface ShareChatDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	chatId: string;
}

export function ShareChatDialog({ open, onOpenChange, chatId }: ShareChatDialogProps) {
	const shareQuery = useQuery({
		...chatApi.sharedChat.getShareOptionsByChatId.queryOptions({ chatId }),
		enabled: open,
	});
	const shareData = shareQuery.data;
	const isShared = !!shareData?.shareId;

	if (shareQuery.isLoading && !shareData) {
		return <ShareLoadingDialog open={open} onOpenChange={onOpenChange} title='Share Chat' />;
	}

	if (shareQuery.isError) {
		return (
			<ShareErrorDialog
				open={open}
				onOpenChange={onOpenChange}
				title='Share Chat'
				onRetry={() => shareQuery.refetch()}
			/>
		);
	}

	if (!isShared) {
		return <CreateShareDialog open={open} onOpenChange={onOpenChange} chatId={chatId} />;
	}

	return (
		<ManageShareDialog
			open={open}
			onOpenChange={onOpenChange}
			chatId={chatId}
			shareId={shareData.shareId}
			visibility={shareData.visibility as Visibility}
			allowedUserIds={shareData.allowedUserIds}
		/>
	);
}

function useInvalidateShareQueries(chatId: string) {
	const queryClient = useQueryClient();
	return useCallback(() => {
		queryClient.invalidateQueries({ queryKey: chatApi.sharedChat.getShareOptionsByChatId.queryKey({ chatId }) });
		queryClient.invalidateQueries({ queryKey: chatApi.sharedChat.list.queryKey() });
	}, [queryClient, chatId]);
}

function CreateShareDialog({ open, onOpenChange, chatId }: ShareChatDialogProps) {
	const { data: session } = useSession();
	const [visibility, setVisibility] = useState<Visibility>('project');
	const [notify, setNotify] = useState(false);
	const [isCopied, setIsCopied] = useState(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const invalidateShareQueries = useInvalidateShareQueries(chatId);
	const smtpQuery = useSmtpSetup();
	const isSmtpEnabled = smtpQuery.data === true;

	useEffect(() => () => clearTimeout(timeoutRef.current), []);

	const currentUserId = session?.user?.id;
	const audience = useShareAudience();
	const { selectedUserIds, search, setSearch, filteredMembers, toggleUser, isLoading, reset } = useMemberPicker(
		currentUserId,
		undefined,
		chatId,
	);
	const effectiveVisibility: Visibility = audience.canShareToProject ? visibility : 'specific';

	useEffect(() => {
		if (open) {
			setVisibility('project');
			setNotify(false);
			reset();
			setIsCopied(false);
		}
	}, [open, reset]);

	const shareMutation = useMutation(chatApi.sharedChat.create.mutationOptions());

	const handleShare = useCallback(() => {
		const blobPromise = shareMutation
			.mutateAsync({
				chatId,
				visibility: effectiveVisibility,
				allowedUserIds: effectiveVisibility === 'specific' ? [...selectedUserIds] : undefined,
				notify: isSmtpEnabled && notify,
			})
			.then((data) => {
				invalidateShareQueries();
				setIsCopied(true);
				clearTimeout(timeoutRef.current);
				timeoutRef.current = setTimeout(() => {
					setIsCopied(false);
					onOpenChange(false);
				}, 1500);
				return new Blob([`${window.location.origin}/shared-chat/${data.id}`], { type: 'text/plain' });
			});

		blobPromise.catch(() => {});
		navigator.clipboard.write([new ClipboardItem({ 'text/plain': blobPromise })]).catch(() => {});
	}, [
		chatId,
		effectiveVisibility,
		selectedUserIds,
		notify,
		isSmtpEnabled,
		shareMutation,
		invalidateShareQueries,
		onOpenChange,
	]);

	const canShare = effectiveVisibility === 'project' || selectedUserIds.size > 0;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className={styles.createShareDialogDialogContent}>
				<DialogHeader>
					<DialogTitle>Share Chat</DialogTitle>
					<DialogDescription>Share a link to this chat with your team.</DialogDescription>
				</DialogHeader>

				<div className={styles.createShareDialogDiv}>
					<VisibilityPicker
						visibility={effectiveVisibility}
						onChange={setVisibility}
						canShareToProject={audience.canShareToProject}
					/>
					{isSmtpEnabled && (
						<NotifyPeopleToggle checked={notify} onCheckedChange={setNotify} itemLabel='chat' />
					)}
					{effectiveVisibility === 'specific' && (
						<MemberPicker
							members={filteredMembers}
							selectedUserIds={selectedUserIds}
							isLoading={isLoading}
							search={search}
							onSearchChange={setSearch}
							onToggleUser={toggleUser}
							emptyMessage={audience.emptyMessage}
						/>
					)}
				</div>

				<div className={styles.createShareDialogDiv2}>
					<Button
						variant='outline'
						className={styles.createShareDialogButton}
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						variant='primary-gradient'
						className={styles.createShareDialogButton2}
						onClick={handleShare}
						disabled={!canShare || shareMutation.isPending}
					>
						{shareMutation.isPending ? (
							<Loader2 className={styles.createShareDialogLoader2} />
						) : isCopied ? (
							<Check className={styles.createShareDialogCheck} />
						) : (
							<LinkIcon className={styles.createShareDialogCheck} />
						)}
						<span>{isCopied ? 'Link copied!' : 'Share & copy link'}</span>
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function ManageShareDialog({
	open,
	onOpenChange,
	chatId,
	shareId,
	visibility,
	allowedUserIds,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	chatId: string;
	shareId: string;
	visibility: Visibility;
	allowedUserIds: string[];
}) {
	const { data: session } = useSession();
	const { isCopied, copy: copyLink } = useCopyWithFeedback();
	const invalidateShareQueries = useInvalidateShareQueries(chatId);

	const currentUserId = session?.user?.id;
	const audience = useShareAudience();
	const { selectedUserIds, search, setSearch, filteredMembers, toggleUser, isLoading, reset } = useMemberPicker(
		currentUserId,
		allowedUserIds,
		chatId,
	);

	const stableAllowedUserIds = useMemo(
		() => allowedUserIds,
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[allowedUserIds.join(',')],
	);

	useEffect(() => {
		if (open) {
			reset(stableAllowedUserIds);
		}
	}, [open, stableAllowedUserIds, reset]);

	const hasChanges = useMemo(
		() => hasAccessChanges(visibility, allowedUserIds, selectedUserIds),
		[visibility, allowedUserIds, selectedUserIds],
	);

	const deleteMutation = useMutation(
		chatApi.sharedChat.delete.mutationOptions({
			onSuccess: () => {
				invalidateShareQueries();
				onOpenChange(false);
			},
		}),
	);

	const updateAccessMutation = useMutation(
		chatApi.sharedChat.updateAccess.mutationOptions({
			onSuccess: () => {
				invalidateShareQueries();
				onOpenChange(false);
			},
		}),
	);

	const handleCopyLink = useCallback(() => {
		copyLink(`${window.location.origin}/shared-chat/${shareId}`);
	}, [copyLink, shareId]);

	const handleUnshare = useCallback(() => {
		deleteMutation.mutate({ shareId });
	}, [shareId, deleteMutation]);

	const handleSaveAccess = useCallback(() => {
		updateAccessMutation.mutate({ shareId, allowedUserIds: [...selectedUserIds] });
	}, [shareId, selectedUserIds, updateAccessMutation]);

	const isBusy = deleteMutation.isPending || updateAccessMutation.isPending;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className={styles.createShareDialogDialogContent}>
				<DialogHeader>
					<DialogTitle>Sharing Settings</DialogTitle>
					<DialogDescription>This chat is currently shared with your team.</DialogDescription>
				</DialogHeader>

				<div className={styles.createShareDialogDiv}>
					<VisibilitySummary visibility={visibility} selectedUserIds={selectedUserIds} itemLabel='chat' />
					{visibility === 'specific' && (
						<MemberPicker
							members={filteredMembers}
							selectedUserIds={selectedUserIds}
							isLoading={isLoading}
							search={search}
							onSearchChange={setSearch}
							onToggleUser={toggleUser}
							emptyMessage={audience.emptyMessage}
						/>
					)}
				</div>

				<ManageShareFooter
					isBusy={isBusy}
					hasChanges={hasChanges}
					isDeletePending={deleteMutation.isPending}
					isUpdatePending={updateAccessMutation.isPending}
					isCopied={isCopied}
					canSave={selectedUserIds.size > 0}
					onUnshare={handleUnshare}
					onSaveAccess={handleSaveAccess}
					onCopyLink={handleCopyLink}
				/>
			</DialogContent>
		</Dialog>
	);
}
