import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MessageSquare, X, ThumbsDown, ThumbsUp, Check, Plug } from 'lucide-react';
import styles from './chat-input-suggestions.module.css';
import type { UIMessage, UIToolPart } from '@loopwise/api/agent/types/chat';
import type { FeedbackVote } from '@/feature/chat/components/chat-messages/assistant-message-actions';
import { FeedbackDialog } from '@/feature/chat/components/chat-messages/assistant-message-actions';
import { Button } from '@/components/ui/button';
import { useAgentContext, useAgentMessagesGetter, useAgentMessagesSelector } from '@/contexts/agent.provider';
import { useChatId } from '@/hooks/use-chat-id';
import { useInactivityTrigger } from '@/hooks/use-inactivity-trigger';
import { checkAssistantMessageHasContent, NEW_CHAT_ID } from '@/lib/ai';
import { createLocalStorage } from '@/lib/local-storage';
import { lastUserMessagePayload } from '@/lib/mcp-auth-retry';
import { openMcpConnectPopup } from '@/lib/mcp-oauth';
import { cn } from '@/lib/utils';
import { chatApi } from '@/lib/chat-api';

/**
 * Milliseconds of inactivity before we ask the user how the conversation went, indexed by how many
 * times they dismissed the prompt across all chats. Every dismissal pushes the next prompt further out.
 */
const FEEDBACK_INACTIVITY_LADDER_MS = [10_000, 15_000, 25_000, 30_000, 45_000, 60_000];

const feedbackDismissCountStorage = createLocalStorage<number>('loopwise-feedback-prompt-dismiss-count', 0);
const feedbackDismissedChatsStorage = createLocalStorage<string[]>('loopwise-feedback-prompt-dismissed-chats', []);

/**
 * A floating panel that sits above the chat input and surfaces a single
 * contextual prompt. Only one suggestion is shown at a time — the MCP
 * connection prompt takes priority over the conversation feedback prompt.
 *
 * When `isHidden` is set (e.g. the user starts typing) the panel smoothly
 * collapses and fades out instead of abruptly unmounting.
 */
export function ChatInputSuggestions({ isHidden = false }: { isHidden?: boolean }) {
	const { isReadonly } = useAgentContext();
	const mcpAuth = useMcpAuthSuggestion();
	const feedback = useConversationFeedback();

	const content = renderSuggestion({ isReadonly, mcpAuth, feedback });
	const isCollapsed = isHidden || !content;
	const { ref, height } = useMeasuredHeight();

	return (
		<div
			className={styles.chatInputSuggestionsDiv}
			style={{
				height: isCollapsed ? 0 : height,
				opacity: isCollapsed ? 0 : 1,
				transition: 'height 300ms ease-out, opacity 300ms ease-out',
			}}
			aria-hidden={isCollapsed}
			inert={isCollapsed}
		>
			<div
				ref={ref}
				className={cn(styles.chatInputSuggestionsDiv2, isCollapsed && styles.chatInputSuggestionsDiv3)}
			>
				{content}
			</div>
		</div>
	);
}

/** Measures the suggestion content height so the panel can collapse to a real, transitionable pixel value. */
function useMeasuredHeight() {
	const ref = useRef<HTMLDivElement>(null);
	const [height, setHeight] = useState(0);

	useLayoutEffect(() => {
		const element = ref.current;
		if (!element) {
			return;
		}
		const observer = new ResizeObserver(() => setHeight(element.offsetHeight));
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	return { ref, height };
}

function renderSuggestion({
	isReadonly,
	mcpAuth,
	feedback,
}: {
	isReadonly: boolean | undefined;
	mcpAuth: McpAuthSuggestion;
	feedback: ConversationFeedback;
}) {
	if (isReadonly) {
		return null;
	}

	if (mcpAuth.isVisible && mcpAuth.server) {
		return (
			<SuggestionCard
				icon={<Plug className={styles.renderSuggestionPlug} />}
				message={`Connect your account to "${mcpAuth.server}" to continue`}
				description={mcpAuth.error}
			>
				<Button variant='ghost' size='sm' className={styles.renderSuggestionButton} onClick={mcpAuth.dismiss}>
					Not now
				</Button>
				<Button
					variant='primary-gradient'
					size='sm'
					className={styles.renderSuggestionButton2}
					onClick={mcpAuth.connect}
					disabled={mcpAuth.connecting}
				>
					{mcpAuth.connecting ? 'Connecting…' : 'Connect'}
				</Button>
			</SuggestionCard>
		);
	}

	if (feedback.showThanks) {
		return (
			<SuggestionCard
				icon={<Check className={styles.renderSuggestionPlug} />}
				message='Thanks for your feedback!'
			/>
		);
	}

	if (feedback.isVisible) {
		return (
			<>
				<SuggestionCard
					icon={<MessageSquare className={styles.renderSuggestionMessageSquare} />}
					message='How did this conversation go?'
					keepActionsInline
				>
					<Button
						variant='ghost'
						size='icon-sm'
						className={styles.renderSuggestionButton3}
						onClick={() => feedback.openFeedbackDialog('up')}
						disabled={feedback.isPending}
						aria-label='Good conversation'
					>
						<ThumbsUp className={styles.renderSuggestionThumbsUp} />
					</Button>
					<Button
						variant='ghost'
						size='icon-sm'
						className={styles.renderSuggestionButton3}
						onClick={() => feedback.openFeedbackDialog('down')}
						disabled={feedback.isPending}
						aria-label='Bad conversation'
					>
						<ThumbsDown className={styles.renderSuggestionThumbsUp} />
					</Button>
					<Button
						variant='ghost'
						size='icon-sm'
						className={styles.renderSuggestionButton4}
						onClick={feedback.dismiss}
						aria-label='Dismiss'
					>
						<X className={styles.renderSuggestionThumbsUp} />
					</Button>
				</SuggestionCard>
				<FeedbackDialog
					open={feedback.feedbackDialogOpen}
					onOpenChange={feedback.setFeedbackDialogOpen}
					onSubmit={(explanation) => feedback.vote(feedback.feedbackDialogVote, explanation)}
					isPending={feedback.isPending}
					vote={feedback.feedbackDialogVote}
				/>
			</>
		);
	}

	return null;
}

interface McpAuthSuggestion {
	isVisible: boolean;
	server: string | null;
	connecting: boolean;
	error?: string;
	connect: () => void;
	dismiss: () => void;
}

/**
 * Detects when the agent attempted an MCP tool that needs the current user to connect their
 * account, and offers an inline Connect action. On success it re-sends the user's last request.
 */
function useMcpAuthSuggestion(): McpAuthSuggestion {
	const { isRunning, queueOrSendMessage } = useAgentContext();
	const getAgentMessages = useAgentMessagesGetter();
	const chatId = useChatId();

	const [connecting, setConnecting] = useState(false);
	const [failure, setFailure] = useState<{ server: string; error?: string }>();
	const [resolved, setResolved] = useState<ReadonlySet<string>>(() => new Set());

	useEffect(() => {
		setResolved(new Set());
		setFailure(undefined);
	}, [chatId]);

	const server = useAgentMessagesSelector(findPendingAuthServer);
	const pendingServer = server && !resolved.has(server) ? server : null;
	const error = failure?.server === pendingServer ? failure.error : undefined;

	const connect = useCallback(async () => {
		if (!pendingServer) {
			return;
		}
		setConnecting(true);
		setFailure(undefined);
		const result = await openMcpConnectPopup(pendingServer);
		setConnecting(false);
		if (!result.connected) {
			setFailure({ server: pendingServer, error: result.error });
			return;
		}
		setResolved((prev) => new Set(prev).add(pendingServer));
		const payload = lastUserMessagePayload(getAgentMessages());
		if (payload) {
			void queueOrSendMessage(payload);
		}
	}, [pendingServer, getAgentMessages, queueOrSendMessage]);

	const dismiss = useCallback(() => {
		if (pendingServer) {
			setResolved((prev) => new Set(prev).add(pendingServer));
		}
	}, [pendingServer]);

	return { isVisible: !!pendingServer && !isRunning, server: pendingServer, connecting, error, connect, dismiss };
}

/** Returns the server from the most recent MCP tool call that reported it needs the user to connect. */
function findPendingAuthServer(messages: UIMessage[]): string | null {
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i];
		if (message.role !== 'assistant') {
			continue;
		}
		for (let j = message.parts.length - 1; j >= 0; j--) {
			const part = message.parts[j];
			const type = (part as { type: string }).type;
			if (type !== 'dynamic-tool' && !type.startsWith('tool-')) {
				continue;
			}
			const output = (part as UIToolPart).output as { mcpAuthRequired?: boolean; server?: string } | undefined;
			if (output?.mcpAuthRequired && output.server) {
				return output.server;
			}
		}
	}
	return null;
}

interface ConversationFeedback {
	isVisible: boolean;
	showThanks: boolean;
	isPending: boolean;
	vote: (vote: FeedbackVote, explanation?: string) => void;
	dismiss: () => void;
	feedbackDialogVote: FeedbackVote;
	feedbackDialogOpen: boolean;
	openFeedbackDialog: (vote: FeedbackVote) => void;
	setFeedbackDialogOpen: (open: boolean) => void;
}

function useConversationFeedback(): ConversationFeedback {
	const { isRunning, mode } = useAgentContext();
	const lastAssistantMessageId = useAgentMessagesSelector(findLastAssistantWithContentId);
	const hasFeedback = useAgentMessagesSelector(checkLastAssistantWithContentHasFeedback);
	const messageCount = useAgentMessagesSelector(countMessages);
	const chatId = useChatId();

	const [dismissCount, setDismissCount] = useState(() => feedbackDismissCountStorage.get() ?? 0);
	const [dismissedChats, setDismissedChats] = useState<ReadonlySet<string>>(
		() => new Set(feedbackDismissedChatsStorage.get() ?? []),
	);
	const [thanksForChat, setThanksForChat] = useState<string | null>(null);
	const [feedbackDialogVote, setFeedbackDialogVote] = useState<FeedbackVote>('down');
	const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);

	const submitFeedback = useMutation(
		chatApi.feedback.submit.mutationOptions({
			onSuccess: (data, variables, _, ctx) => {
				ctx.client.setQueryData(chatApi.chat.get.queryKey({ chatId: variables.chatId }), (prev) =>
					prev
						? {
								...prev,
								messages: prev.messages.map((message) =>
									message.id === variables.messageId ? { ...message, feedback: data } : message,
								),
							}
						: prev,
				);
				setThanksForChat(variables.chatId);
				setFeedbackDialogOpen(false);
			},
		}),
	);

	const isPersistedChat = !!chatId && chatId !== NEW_CHAT_ID;
	const isDismissed = !!chatId && dismissedChats.has(chatId);
	const isEligible =
		mode !== 'onboarding' &&
		isPersistedChat &&
		!isRunning &&
		!!lastAssistantMessageId &&
		!hasFeedback &&
		!isDismissed;

	const isTriggered = useInactivityTrigger({
		enabled: isEligible,
		delayMs: feedbackInactivityDelay(dismissCount),
		resetKey: `${chatId}:${messageCount}`,
	});

	const showThanks = !!chatId && thanksForChat === chatId;

	const dismissForChat = useCallback(() => {
		if (!chatId) {
			return;
		}
		setDismissedChats((prev) => {
			const next = new Set(prev).add(chatId);
			feedbackDismissedChatsStorage.set([...next]);
			return next;
		});
	}, [chatId]);

	useEffect(() => {
		if (!showThanks) {
			return;
		}
		const timer = window.setTimeout(() => {
			dismissForChat();
			setThanksForChat(null);
		}, 2_500);
		return () => window.clearTimeout(timer);
	}, [showThanks, dismissForChat]);

	const vote = useCallback(
		(value: FeedbackVote, explanation?: string) => {
			if (!chatId || !lastAssistantMessageId) {
				return;
			}
			submitFeedback.mutate({ chatId, messageId: lastAssistantMessageId, vote: value, explanation });
		},
		[chatId, lastAssistantMessageId, submitFeedback],
	);

	const openFeedbackDialog = useCallback((value: FeedbackVote) => {
		setFeedbackDialogVote(value);
		setFeedbackDialogOpen(true);
	}, []);

	const dismiss = useCallback(() => {
		dismissForChat();
		setDismissCount((prev) => {
			const next = prev + 1;
			feedbackDismissCountStorage.set(next);
			return next;
		});
	}, [dismissForChat]);

	return {
		isVisible: isEligible && isTriggered,
		showThanks,
		isPending: submitFeedback.isPending,
		vote,
		dismiss,
		feedbackDialogVote,
		feedbackDialogOpen,
		openFeedbackDialog,
		setFeedbackDialogOpen,
	};
}

function feedbackInactivityDelay(dismissCount: number): number {
	const index = Math.min(dismissCount, FEEDBACK_INACTIVITY_LADDER_MS.length - 1);
	return FEEDBACK_INACTIVITY_LADDER_MS[index];
}

export function SuggestionCard({
	icon,
	message,
	description,
	children,
	keepActionsInline = false,
}: {
	icon?: React.ReactNode;
	message: string;
	description?: string;
	children?: React.ReactNode;
	keepActionsInline?: boolean;
}) {
	return (
		<div
			data-selection-ignore
			className={cn(`${styles.suggestionCardDiv} group`, icon && styles.suggestionCardDiv2)}
		>
			{icon && <div className={styles.suggestionCardDiv3}>{icon}</div>}
			<div className={cn(styles.suggestionCardDiv4, icon && styles.suggestionCardDiv5)}>
				<p className={styles.suggestionCardP}>{message}</p>
				{description && <ExpandableDescription key={description} description={description} />}
			</div>
			{children && (
				<div
					className={cn(
						styles.suggestionCardDiv6,
						keepActionsInline ? styles.suggestionCardDiv7 : styles.suggestionCardDiv8,
						icon && !keepActionsInline && styles.suggestionCardDiv9,
					)}
				>
					{children}
				</div>
			)}
		</div>
	);
}

function ExpandableDescription({ description }: { description: string }) {
	const textRef = useRef<HTMLParagraphElement>(null);
	const [isExpanded, setExpanded] = useState(false);
	const [isOverflowing, setOverflowing] = useState(false);

	useLayoutEffect(() => {
		const element = textRef.current;
		if (!element || isExpanded) {
			return;
		}
		const updateOverflow = () => {
			const lineHeight = Number.parseFloat(window.getComputedStyle(element).lineHeight);
			const overflowThreshold = Number.isFinite(lineHeight) ? lineHeight / 2 : 1;
			setOverflowing(element.scrollHeight - element.clientHeight > overflowThreshold);
		};
		const observer = new ResizeObserver(updateOverflow);
		observer.observe(element);
		return () => observer.disconnect();
	}, [isExpanded]);

	return (
		<>
			<div className={styles.expandableDescriptionDiv}>
				<p ref={textRef} className={cn(!isExpanded && styles.expandableDescriptionP)}>
					{description}
				</p>
				{isOverflowing && (
					<button
						type='button'
						className={styles.expandableDescriptionButton}
						aria-expanded={isExpanded}
						onClick={() => setExpanded((expanded) => !expanded)}
					>
						{isExpanded ? 'Show less' : 'Read more'}
					</button>
				)}
			</div>
			<p className={styles.expandableDescriptionP2}>{description}</p>
		</>
	);
}

function findLastAssistantWithContentId(messages: UIMessage[]): string | undefined {
	return findLastAssistantWithContent(messages)?.id;
}

function checkLastAssistantWithContentHasFeedback(messages: UIMessage[]): boolean {
	return !!findLastAssistantWithContent(messages)?.feedback;
}

function countMessages(messages: UIMessage[]): number {
	return messages.length;
}

function findLastAssistantWithContent(messages: UIMessage[]): UIMessage | undefined {
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i];
		if (message.role === 'assistant' && checkAssistantMessageHasContent(message)) {
			return message;
		}
	}
	return undefined;
}
