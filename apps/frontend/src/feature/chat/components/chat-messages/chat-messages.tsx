import { memo, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouterState } from '@tanstack/react-router';
import { ChatError } from './chat-error';
import { FollowUpSuggestions } from './follow-up-suggestions';
import { AssistantMessage } from './assistant-message';
import { UserMessage } from './user-message';
import styles from './chat-messages.module.css';
import type { UIMessage } from '@loopwise/api/agent/types/chat';
import type { MessageGroup } from '@/types/ai';
import { TextShimmer } from '@/components/ui/text-shimmer';
import {
	groupMessages,
	checkIsLastMessageStreaming,
	getLastFollowUpSuggestionsToolCall,
	checkIsSomeToolsExecuting,
	isOnboardingContextRequestMessage,
} from '@/lib/ai';
import {
	Conversation,
	ConversationContent,
	ConversationEmptyState,
	ConversationScrollButton,
} from '@/components/ui/conversation';
import { areArraysShallowEqual, cn, isLast } from '@/lib/utils';
import { useAgentContext, useAgentMessages } from '@/contexts/agent.provider';
import { useDebounceValue } from '@/hooks/use-debounce-value';
import { useVisibleMessages } from '@/hooks/use-visible-messages';
import { useScrollToBottomOnNewUserMessage } from '@/hooks/use-scroll-to-bottom-on-new-user-message';
import { useChatId } from '@/hooks/use-chat-id';
import { chatApi } from '@/lib/chat-api';

const DEBUG_MESSAGES = false;

export function ChatMessages() {
	const chatId = useParams({ strict: false }).chatId;

	// Skip fade-in animation when navigating from home after sending a message
	const fromMessageSend = useRouterState({ select: (state) => state.location.state.fromMessageSend });

	return (
		<div className={cn(styles.chatMessagesDiv, !fromMessageSend && styles.chatMessagesDiv2)} key={chatId}>
			<Conversation>
				<ConversationContent className={styles.chatMessagesConversationContent}>
					<ChatMessagesContent />
					<div
						className={styles.chatMessagesDiv3}
						style={{ height: 'var(--chat-input-height, 0px)' }}
						aria-hidden
					/>
				</ConversationContent>

				<ConversationScrollButton className={styles.chatMessagesConversationScrollButton} />
			</Conversation>
		</div>
	);
}

export const ChatMessagesContent = memo(function ChatMessagesContent() {
	const chatId = useChatId();
	const { isRunning } = useAgentContext();
	const messages = useAgentMessages();
	const isAgentGenerating = isRunning && checkIsLastMessageStreaming(messages);
	const someToolsExectuting = isRunning && checkIsSomeToolsExecuting(messages);

	// Debounce when the agent is running but not generating content yet to prevent flickering
	const showThinkingLoader = useDebounceValue(isRunning && !isAgentGenerating && !someToolsExectuting, {
		delay: 50,
		skipDebounce: (value) => !value, // Skip debounce if the value equals `false` to immediately remove the loader
	});
	const followUpSuggestionsToolCall = useMemo(() => getLastFollowUpSuggestionsToolCall(messages), [messages]);
	const displayableMessages = useMemo(
		() => messages.filter((message) => !isOnboardingContextRequestMessage(message)),
		[messages],
	);
	const visibleMessages = useVisibleMessages(displayableMessages);
	const messageGroups = useMemo(() => groupMessages(visibleMessages), [visibleMessages]);
	const lastMessageId = visibleMessages.at(-1)?.id;

	const forkMetadata = useQuery({
		...chatApi.chat.getForkMetadata.queryOptions({ chatId: chatId ?? '' }),
		enabled: !!chatId,
	});
	const storyIntroMessageId =
		forkMetadata.data?.type === 'story' ? messageGroups[0]?.assistantMessages[0]?.id : undefined;

	useScrollToBottomOnNewUserMessage(messages);

	return (
		<div className={styles.chatMessagesContentDiv}>
			<div className={styles.chatMessagesContentDiv2}>
				{messageGroups.length === 0 ? (
					<ConversationEmptyState />
				) : (
					messageGroups.map((group) => (
						<MessageGroup
							key={group.userMessage?.id ?? group.assistantMessages[0]?.id}
							userMessage={group.userMessage}
							assistantMessages={group.assistantMessages}
							showLoader={showThinkingLoader && isLast(group, messageGroups)}
							lastMessageId={lastMessageId}
							isRunning={isRunning}
							storyIntroMessageId={storyIntroMessageId}
						/>
					))
				)}
			</div>

			<div className={styles.chatMessagesContentDiv3} data-selection-ignore>
				{followUpSuggestionsToolCall && <FollowUpSuggestions toolPart={followUpSuggestionsToolCall} />}

				<ChatError className={styles.chatMessagesContentChatError} />
			</div>
		</div>
	);
});

interface MessageGroupProps {
	userMessage: UIMessage | null;
	assistantMessages: UIMessage[];
	showLoader: boolean;
	lastMessageId: string | undefined;
	isRunning: boolean;
	storyIntroMessageId: string | undefined;
}

function areMessageGroupPropsEqual(previous: MessageGroupProps, next: MessageGroupProps): boolean {
	return (
		previous.userMessage === next.userMessage &&
		areArraysShallowEqual(previous.assistantMessages, next.assistantMessages) &&
		previous.showLoader === next.showLoader &&
		previous.lastMessageId === next.lastMessageId &&
		previous.isRunning === next.isRunning &&
		previous.storyIntroMessageId === next.storyIntroMessageId
	);
}

const MessageGroup = memo(
	({
		userMessage,
		assistantMessages,
		showLoader,
		lastMessageId,
		isRunning,
		storyIntroMessageId,
	}: MessageGroupProps) => {
		const messages = userMessage ? [userMessage, ...assistantMessages] : assistantMessages;
		return (
			<div className={`${styles.messageGroupDiv} group/message`}>
				{messages.map((message) => (
					<MessageBlock
						key={message.id}
						message={message}
						showLoader={showLoader}
						isLastMessage={message.id === lastMessageId}
						isRunning={isRunning}
						storyIntroMessageId={storyIntroMessageId}
					/>
				))}

				{showLoader && !assistantMessages.length && (
					<TextShimmer showLogo className={styles.messageGroupTextShimmer} />
				)}
			</div>
		);
	},
	areMessageGroupPropsEqual,
);

const MessageBlock = memo(
	({
		message,
		showLoader,
		isLastMessage,
		isRunning,
		storyIntroMessageId,
	}: {
		message: UIMessage;
		showLoader: boolean;
		isLastMessage: boolean;
		isRunning: boolean;
		storyIntroMessageId: string | undefined;
	}) => {
		const isUser = message.role === 'user';

		if (DEBUG_MESSAGES) {
			return (
				<div className={cn(styles.messageBlockDiv, isUser ? styles.messageBlockDiv2 : styles.messageBlockDiv3)}>
					<pre>{JSON.stringify(message, null, 2)}</pre>
				</div>
			);
		}

		if (isUser) {
			return <UserMessage message={message} />;
		}

		return (
			<AssistantMessage
				message={message}
				showLoader={showLoader && isLastMessage}
				isSettled={!isLastMessage || !isRunning}
				isRunning={isRunning}
				isLastMessage={isLastMessage}
				storyIntroMessageId={storyIntroMessageId}
			/>
		);
	},
);
