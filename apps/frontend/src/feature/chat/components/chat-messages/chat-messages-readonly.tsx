import { memo, useMemo } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { filterSupersededExecuteSqlParts } from '@quarry/shared/execute-sql-parts';
import { UserMessageBubble } from './user-message';
import { MessageModelLabel } from './message-model-label';
import { AssistantCompaction } from './assistant-compaction';
import { MessageParts } from './assistant-message';
import styles from './chat-messages-readonly.module.css';
import type { StickToBottomContext } from 'use-stick-to-bottom';
import type { ForkMetadata, MessageModel, UIMessage } from '@quarry/api/agent/types/chat';
import { SelectionCitationExcerpt } from '@/feature/chat/components/selection-citation-excerpt';
import { checkAssistantMessageHasContent, groupMessages, groupToolCalls } from '@/lib/ai';
import { cn } from '@/lib/utils';
import {
	Conversation,
	ConversationContent,
	ConversationEmptyState,
	ConversationScrollButton,
} from '@/components/ui/conversation';
import { AssistantMessageProvider } from '@/contexts/assistant-message';
import { useToolCallDensity } from '@/hooks/use-tool-call-density';

export type MessageModelMap = Record<string, MessageModel>;

export function ChatMessagesReadonly({
	messages,
	className,
	contentClassName,
	forkMetadata,
	conversationContextRef,
	messageModels,
}: {
	messages: UIMessage[];
	className?: string;
	contentClassName?: string;
	forkMetadata?: ForkMetadata;
	conversationContextRef?: React.Ref<StickToBottomContext>;
	messageModels?: MessageModelMap;
}) {
	const messageGroups = useMemo(() => groupMessages(filterSupersededExecuteSqlParts(messages)), [messages]);

	const citation = useMemo(() => {
		if (!forkMetadata?.selectionText || forkMetadata.selectionStart == null || forkMetadata.selectionEnd == null) {
			return null;
		}
		const isForkedMessage = [...messages].reverse().find((m: UIMessage) => m.isForked === true);
		if (!isForkedMessage) {
			return null;
		}
		const rawText = forkMetadata.selectionText;
		const text = rawText.length > 200 ? `${rawText.slice(0, 200)}\u2026` : rawText;
		const citationLabel = `@chars ${forkMetadata.selectionStart}–${forkMetadata.selectionEnd}`;
		return { id: isForkedMessage.id, citation: citationLabel, text };
	}, [messages, forkMetadata]);

	return (
		<div className={cn(styles.chatMessagesReadonlyDiv, className)}>
			<Conversation contextRef={conversationContextRef}>
				<ConversationContent
					className={cn(styles.chatMessagesReadonlyConversationContent, contentClassName)}
					data-selection-container
				>
					{messageGroups.length === 0 ? (
						<ConversationEmptyState title='No messages' description='' />
					) : (
						messageGroups.map((group) => (
							<MessageGroupReadonly
								key={group.userMessage?.id ?? group.assistantMessages[0]?.id}
								userMessage={group.userMessage}
								assistantMessages={group.assistantMessages}
								citation={citation}
								messageModels={messageModels}
							/>
						))
					)}
				</ConversationContent>

				<ConversationScrollButton />
			</Conversation>
		</div>
	);
}

const MessageGroupReadonly = ({
	userMessage,
	assistantMessages,
	citation,
	messageModels,
}: {
	userMessage: UIMessage | null;
	assistantMessages: UIMessage[];
	citation: { id: string; citation: string; text: string } | null;
	messageModels?: MessageModelMap;
}) => {
	const messages = userMessage ? [userMessage, ...assistantMessages] : assistantMessages;
	return (
		<div className={styles.messageGroupReadonlyDiv}>
			{messages.map((message) => (
				<MessageBlockReadonly
					key={message.id}
					message={message}
					citation={citation}
					messageModels={messageModels}
				/>
			))}
		</div>
	);
};

const MessageBlockReadonly = ({
	message,
	citation,
	messageModels,
}: {
	message: UIMessage;
	citation: { id: string; citation: string; text: string } | null;
	messageModels?: MessageModelMap;
}) => {
	if (message.isForked && citation?.id === message.id) {
		return <CitationBlockReadonly citation={citation} />;
	}

	if (message.role === 'user') {
		return <UserMessageReadonly message={message} />;
	}

	return <AssistantMessageReadonly message={message} model={messageModels?.[message.id]} />;
};

const UserMessageReadonly = memo(({ message }: { message: UIMessage }) => {
	return (
		<div className={styles.userMessageReadonlyDiv} data-replay-target-id={message.id}>
			<UserMessageBubble message={message} />
		</div>
	);
});

const AssistantMessageReadonly = memo(({ message, model }: { message: UIMessage; model?: MessageModel }) => {
	const [toolCallDensity] = useToolCallDensity();
	const messageParts = useMemo(
		() => groupToolCalls(message.parts, toolCallDensity),
		[message.parts, toolCallDensity],
	);
	const hasContent = useMemo(() => checkAssistantMessageHasContent(message), [message]);
	const isCompacting = message.parts.at(-1)?.type === 'data-compactionSummaryStarted';

	if (!message.parts.length) {
		return null;
	}

	return (
		<AssistantMessageProvider isSettled={true}>
			<div className={cn(`${styles.assistantMessageReadonlyDiv} group`)} data-replay-target-id={message.id}>
				<MessageParts parts={messageParts} />

				{model && <MessageModelLabel model={model} />}

				{message.feedback && (
					<div
						data-replay-nav='feedback'
						data-replay-bordered='true'
						data-replay-nav-vote={message.feedback.vote}
						className={styles.assistantMessageReadonlyDiv2}
					>
						{message.feedback.vote === 'up' ? (
							<ThumbsUp className={styles.assistantMessageReadonlyThumbsUp} />
						) : (
							<ThumbsDown className={styles.assistantMessageReadonlyThumbsDown} />
						)}
						<span>Feedback</span>
						{message.feedback.explanation != null && message.feedback.explanation.trim() !== '' && (
							<span className={styles.assistantMessageReadonlySpan}>
								{' '}
								: {message.feedback.explanation}
							</span>
						)}
					</div>
				)}

				{!hasContent && <div className={styles.assistantMessageReadonlyDiv3}>No response</div>}

				{isCompacting && <AssistantCompaction />}
			</div>
		</AssistantMessageProvider>
	);
});

const CitationBlockReadonly = ({ citation }: { citation: { id: string; citation: string; text: string } }) => {
	return (
		<div className={styles.citationBlockReadonlyDiv}>
			<SelectionCitationExcerpt label={citation.citation} text={citation.text} maxLength={0} />
		</div>
	);
};
