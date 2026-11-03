import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef } from 'react';
import styles from './shared-chat-page.module.css';
import { ChatMessagesReadonly } from '@/feature/chat/components/chat-messages/chat-messages-readonly';
import { HighlightBubble } from '@/feature/chat/components/highlight-bubble';
import { SharedChatAskBar } from '@/feature/chat/components/shared-chat-ask-bar';
import { SharedChatButton } from '@/feature/chat/components/shared-chat-button';
import { SidePanel } from '@/components/side-panel/side-panel';
import { Spinner } from '@/components/ui/spinner';
import { useSession } from '@/lib/auth-client';
import { ReadonlyAgentMessagesProvider } from '@/contexts/agent.provider';
import { useSidePanel } from '@/hooks/use-side-panel';
import { SidePanelProvider } from '@/contexts/side-panel';
import { SelectionProvider } from '@/contexts/text-selection';
import { requestAskAboutSelection } from '@/stores/ask-bar';
import { chatApi } from '@/lib/chat-api';

const Route = getRouteApi('/_protected/shared-chat/$shareId');

export function SharedChatPage() {
	const { shareId } = Route.useParams();
	const { data: session } = useSession();
	const navigate = useNavigate();

	const queryClient = useQueryClient();
	const chatQuery = useQuery(chatApi.sharedChat.getSharedChat.queryOptions({ shareId }));
	const isViewer = chatQuery.data?.userRole === 'viewer';
	const forkMutation = useMutation(
		chatApi.chatFork.fork.mutationOptions({
			onSuccess: (data) => {
				queryClient.invalidateQueries({ queryKey: [['chat', 'listGrouped']] });
				navigate({ to: '/$chatId', params: { chatId: data.chatId } });
			},
		}),
	);

	const containerRef = useRef<HTMLDivElement>(null);
	const sidePanelRef = useRef<HTMLDivElement>(null);
	const sidePanel = useSidePanel({ containerRef, sidePanelRef });
	const shareSource = useMemo(() => ({ type: 'chat' as const, shareId }), [shareId]);

	const sharedChatData = chatQuery.data;
	const isOwner = session?.user?.id === sharedChatData?.share.userId;

	if (chatQuery.isLoading) {
		return (
			<div className={styles.sharedChatPageDiv}>
				<Spinner />
			</div>
		);
	}

	if (!chatQuery.data) {
		return (
			<div className={styles.sharedChatPageDiv}>
				<p className={styles.sharedChatPageP}>Chat not found.</p>
			</div>
		);
	}

	const { share, chat } = chatQuery.data;

	return (
		<ReadonlyAgentMessagesProvider messages={chat.messages} chatId={share.chatId}>
			<SidePanelProvider
				isVisible={sidePanel.isVisible}
				currentStorySlug={sidePanel.currentStorySlug}
				setCurrentStorySlug={sidePanel.setCurrentStorySlug}
				currentStoryTabIndex={sidePanel.currentStoryTabIndex}
				setCurrentStoryTabIndex={sidePanel.setCurrentStoryTabIndex}
				chatId={share.chatId}
				shareSource={shareSource}
				isReadonlyMode={!isOwner}
				open={sidePanel.open}
				close={sidePanel.close}
			>
				<div className={styles.sharedChatPageDiv2} ref={containerRef}>
					<header className={styles.sharedChatPageHeader}>
						<h1 className={styles.sharedChatPageH1}>{share.title}</h1>
						<span className={styles.sharedChatPageSpan}>by {share.authorName}</span>
						{isOwner && (
							<SharedChatButton
								shareId={shareId}
								label='Open chat'
								onClick={() => navigate({ to: '/$chatId', params: { chatId: share.chatId } })}
							/>
						)}
						{!isOwner && !isViewer && (
							<SharedChatButton
								shareId={shareId}
								label='Continue chat'
								isPending={forkMutation.isPending}
								onClick={() => forkMutation.mutate({ source: shareSource })}
							/>
						)}
					</header>

					<SelectionProvider key={shareId}>
						{!isViewer && <HighlightBubble onAsk={requestAskAboutSelection} />}
						<div className={styles.sharedChatPageDiv3}>
							<div className={styles.sharedChatPageDiv4}>
								<ChatMessagesReadonly
									className={styles.sharedChatPageChatMessagesReadonly}
									contentClassName={isViewer ? undefined : styles.sharedChatPageChatMessagesReadonly2}
									messages={chat.messages}
									forkMetadata={chat.forkMetadata}
								/>
								{!isViewer && <SharedChatAskBar shareId={shareId} />}
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
				</div>
			</SidePanelProvider>
		</ReadonlyAgentMessagesProvider>
	);
}
