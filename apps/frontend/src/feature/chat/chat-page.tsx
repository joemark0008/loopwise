import { getRouteApi, useRouter } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Folder, GitFork, Globe, Upload } from 'lucide-react';
import { SYSTEM_EXAMPLE_CLINIC_ID } from '@loopwise/shared';
import styles from './chat-page.module.css';
import type { ForkMetadata } from '@loopwise/api/agent/types/chat';
import type { SelectionData } from '@/feature/chat/components/highlight-bubble';
import type { Chat } from '@/queries/use-chat-query';
import { NEW_CHAT_ID } from '@/lib/ai';
import { ChatAccessError } from '@/feature/chat/components/chat-access-error';
import { ExampleClinicInfoCard } from '@/feature/chat/components/example-clinic-info-card';
import { ChatInput } from '@/feature/chat/components/chat-input';
import { ChatMessages } from '@/feature/chat/components/chat-messages/chat-messages';
import { HighlightBubble } from '@/feature/chat/components/highlight-bubble';
import { SidePanel } from '@/components/side-panel/side-panel';
import { MobileHeader } from '@/layout/mobile-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useAgentContext } from '@/contexts/agent.provider';
import { useSidePanel } from '@/hooks/use-side-panel';
import { SidePanelProvider } from '@/contexts/side-panel';
import { EditableChatTitle } from '@/feature/chat/components/editable-chat-title';
import { useChatQuery } from '@/queries/use-chat-query';
import { useHeight } from '@/hooks/use-height';
import { ShareChatDialog } from '@/components/share-dialog.chat';
import { usePermissions } from '@/hooks/use-permissions';
import { SelectionProvider } from '@/contexts/text-selection';
import { chatPendingCitationStore } from '@/stores/chat-pending-citation';
import { useSetChatInputCallback } from '@/contexts/set-chat-input-callback';
import { shouldShowChatAccessError } from '@/lib/api-error';
import { useClinics } from '@/hooks/use-current-clinic';
import { chatApi } from '@/lib/chat-api';

const Route = getRouteApi('/_protected/_chat-layout/$chatId');

const SELECTION_FORK_TYPES: ForkMetadata['type'][] = ['chat_selection', 'chat_question'];

export function RouteComponent() {
	const { chatId } = Route.useParams();
	const { isViewer } = usePermissions();
	const router = useRouter();

	useEffect(() => {
		if (isViewer && chatId === NEW_CHAT_ID) {
			router.navigate({ to: '/' });
		}
	}, [isViewer, chatId, router]);

	if (isViewer && chatId === NEW_CHAT_ID) {
		return null;
	}

	return <ChatPage />;
}

function ChatPage() {
	const { isLoadingMessages, isRunning } = useAgentContext();
	const { chatId } = Route.useParams();
	const chat = useChatQuery({ chatId, select: selectChatHeader });
	const title = chat.data?.title;

	const shouldShowChatError = shouldShowChatAccessError(chat);

	const shareQuery = useQuery({
		...chatApi.sharedChat.getShareOptionsByChatId.queryOptions({ chatId }),
		enabled: !!chat.data && !shouldShowChatError,
	});
	const isShared = !!shareQuery.data?.shareId;
	const clinics = useClinics();
	const isExampleChat = chat.data?.clinicId === SYSTEM_EXAMPLE_CLINIC_ID;
	const isInMultipleClinics = (clinics.data?.length ?? 0) > 1;
	const chatClinic = isInMultipleClinics ? clinics.data?.find((p) => p.id === chat.data?.clinicId) : undefined;

	const containerRef = useRef<HTMLDivElement>(null);
	const chatColumnRef = useRef<HTMLDivElement>(null);
	const sidePanelRef = useRef<HTMLDivElement>(null);
	const inputAreaRef = useRef<HTMLDivElement>(null);
	const inputAreaHeight = useHeight(inputAreaRef);

	const sidePanel = useSidePanel({ containerRef, sidePanelRef });
	const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
	const chatInputCallback = useSetChatInputCallback();

	const handleSelectionAsk = useCallback(
		(data: SelectionData) => {
			const { range: _range, ...selection } = data;
			chatPendingCitationStore.set({ chatId, ...selection });
			chatInputCallback.fire('');
		},
		[chatId, chatInputCallback],
	);

	const isSelectionFork = SELECTION_FORK_TYPES.includes(chat.data?.forkMetadata?.type ?? 'chat');
	const headerCitation = buildHeaderCitation(isSelectionFork ? chat.data?.forkMetadata : undefined);

	if (shouldShowChatError) {
		return <ChatAccessError error={chat.error} onRetry={() => chat.refetch()} chatId={chatId} />;
	}
	return (
		<SidePanelProvider
			isVisible={sidePanel.isVisible}
			currentStorySlug={sidePanel.currentStorySlug}
			setCurrentStorySlug={sidePanel.setCurrentStorySlug}
			currentStoryTabIndex={sidePanel.currentStoryTabIndex}
			setCurrentStoryTabIndex={sidePanel.setCurrentStoryTabIndex}
			chatId={chatId}
			open={sidePanel.open}
			close={sidePanel.close}
		>
			<SelectionProvider resetKey={chatId}>
				<div className={styles.chatPageDiv} ref={containerRef}>
					<div
						ref={chatColumnRef}
						className={styles.chatPageDiv2}
						style={{ '--chat-input-height': `${inputAreaHeight}px` } as React.CSSProperties}
					>
						<MobileHeader
							chatId={chatId}
							title={title}
							showExampleClinicInfo={isExampleChat && !chat.data?.isOnboarding}
						/>

						<div className={`${styles.chatPageDiv3} group/header`}>
							<div className={styles.chatPageDiv4}>
								{title && (
									<EditableChatTitle
										chatId={chatId}
										title={title}
										className={styles.chatPageEditableChatTitle}
									/>
								)}
								{chatClinic && (
									<Badge variant='outline' className={styles.chatPageBadge}>
										<Folder />
										<span className={styles.chatPageSpan}>{chatClinic.name}</span>
									</Badge>
								)}
								{chat.data?.forkMetadata && (
									<Badge variant='outline' className={styles.chatPageBadge}>
										<GitFork />
										<span className={styles.chatPageSpan}>Chat thread from </span>
										<span className={styles.chatPageSpan2}>
											{chat.data.forkMetadata.authorName}
										</span>
										{headerCitation && (
											<span className={styles.chatPageSpan}>
												{' '}
												— {headerCitation.citation}: &ldquo;{headerCitation.text}&rdquo;
											</span>
										)}
									</Badge>
								)}
							</div>
							<div className={styles.chatPageDiv5}>
								{isExampleChat && !chat.data?.isOnboarding && <ExampleClinicInfoCard compact />}
								<Button
									variant='outline'
									size='icon-sm'
									className={styles.chatPageButton}
									onClick={() => setIsShareDialogOpen(true)}
									disabled={isRunning}
									aria-label='Share Chat'
								>
									{!isRunning && isShared ? (
										<>
											<Globe className={styles.chatPageGlobe} />
											<span className={styles.chatPageSpan3}>Chat shared</span>
										</>
									) : (
										<>
											<Upload className={styles.chatPageUpload} strokeWidth={2.25} />
											<span className={styles.chatPageSpan3}>Share chat</span>
										</>
									)}
								</Button>
							</div>
						</div>

						<div className={styles.chatPageDiv6}>
							<div className={styles.chatPageDiv7} />
							<div className={styles.chatPageDiv8} />
						</div>

						{isLoadingMessages ? (
							<div className={styles.chatPageDiv9}>
								<Spinner />
							</div>
						) : (
							<>
								<HighlightBubble onAsk={handleSelectionAsk} disabled={isRunning} />
								<ChatMessages />
							</>
						)}
						<div className={styles.chatPageDiv10}>
							<div ref={inputAreaRef} className={styles.chatPageDiv11}>
								<ChatInput />
							</div>
						</div>
					</div>

					{sidePanel.content && (
						<SidePanel
							containerRef={containerRef}
							isAnimating={sidePanel.isAnimating}
							sidePanelRef={sidePanelRef}
							resizeHandleRef={sidePanel.resizeHandleRef}
						>
							{sidePanel.content}
						</SidePanel>
					)}
				</div>
			</SelectionProvider>
			<ShareChatDialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen} chatId={chatId} />
		</SidePanelProvider>
	);
}

function selectChatHeader(chat: Chat) {
	return {
		title: chat.title,
		clinicId: chat.clinicId,
		isOnboarding: chat.isOnboarding,
		forkMetadata: chat.forkMetadata,
		automationRun: chat.automationRun,
	};
}

function buildHeaderCitation(meta: ForkMetadata | undefined): { citation: string; text: string } | null {
	if (!meta?.selectionText) {
		return null;
	}
	const text = meta.selectionText.length > 20 ? `${meta.selectionText.slice(0, 20)}\u2026` : meta.selectionText;
	const citation = `@chars ${meta.selectionStart}–${meta.selectionEnd}`;
	return { citation, text };
}
