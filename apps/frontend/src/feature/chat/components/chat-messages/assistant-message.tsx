import { memo, useMemo } from 'react';
import { AssistantReasoning } from './assistant-reasoning';
import { AssistantCompaction } from './assistant-compaction';
import { AssistantTextWithCitation } from './citation-text';
import { AssistantMessageActions } from './assistant-message-actions';
import styles from './assistant-message.module.css';
import type { UIMessage } from '@loopwise/api/agent/types/chat';
import type { GroupedMessagePart } from '@/types/ai';
import {
	areGroupedMessagePartArraysEqual,
	areGroupedMessagePartsEqual,
	checkAssistantMessageHasContent,
	groupToolCalls,
	isQueryGroupPart,
	isToolGroupPart,
	isToolUIPart,
} from '@/lib/ai';
import { ToolCallsGroup } from '@/feature/chat/components/tool-calls/tool-calls-group';
import { QueryGroup } from '@/feature/chat/components/tool-calls/query-group';
import { ToolCall } from '@/feature/chat/components/tool-calls/index';
import { TextShimmer } from '@/components/ui/text-shimmer';
import { cn, isLast } from '@/lib/utils';
import { useChatId } from '@/hooks/use-chat-id';
import { useIsCancellingMessage } from '@/hooks/use-is-cancelling-message-store';
import { useToolCallDensity } from '@/hooks/use-tool-call-density';
import { AssistantMessageProvider, useAssistantMessage } from '@/contexts/assistant-message';
import { useAgentContext } from '@/contexts/agent.provider';

export const AssistantMessage = memo(
	({
		message,
		showLoader,
		isSettled,
		isRunning,
		isLastMessage,
		storyIntroMessageId,
	}: {
		message: UIMessage;
		showLoader: boolean;
		isSettled: boolean;
		isRunning: boolean;
		isLastMessage: boolean;
		storyIntroMessageId: string | undefined;
	}) => {
		const chatId = useChatId();
		const { error } = useAgentContext();
		const [toolCallDensity] = useToolCallDensity();
		const messageParts = useMemo(
			() => groupToolCalls(message.parts, toolCallDensity),
			[message.parts, toolCallDensity],
		);
		const hasContent = useMemo(() => checkAssistantMessageHasContent(message), [message]);
		const isCancelling = useIsCancellingMessage(message.id);
		const isCompacting = message.parts.at(-1)?.type === 'data-compactionSummaryStarted';
		const showActions = message.id !== storyIntroMessageId;
		const hasFeedback = message.feedback != null;

		if (!message.parts.length && isSettled) {
			return null;
		}

		if (isCancelling && isSettled && !hasContent) {
			return null;
		}

		return (
			<AssistantMessageProvider isSettled={isSettled}>
				<div className={cn(`${styles.assistantMessageDiv} group`)}>
					<MessageParts parts={messageParts} />

					{isSettled && !hasContent && !(isLastMessage && error) && (
						<div className={styles.assistantMessageDiv2}>No response</div>
					)}

					{isCompacting ? <AssistantCompaction /> : showLoader && <TextShimmer showLogo />}

					{chatId && showActions && (
						<AssistantMessageActions
							message={message}
							chatId={chatId}
							className={cn(
								styles.assistantMessageAssistantMessageActions,
								isLastMessage
									? isRunning
										? styles.assistantMessageAssistantMessageActions2
										: styles.assistantMessageAssistantMessageActions3
									: hasFeedback
										? styles.assistantMessageAssistantMessageActions3
										: styles.assistantMessageAssistantMessageActions4,
							)}
						/>
					)}
				</div>
			</AssistantMessageProvider>
		);
	},
);

export const MessageParts = memo(
	({ parts }: { parts: GroupedMessagePart[] }) => {
		const { isSettled } = useAssistantMessage();
		return parts.map((part, i) => {
			return <MessagePart key={i} part={part} isPartSettled={isSettled || !isLast(part, parts)} />;
		});
	},
	(previous, next) => areGroupedMessagePartArraysEqual(previous.parts, next.parts),
);

export const MessagePart = memo(
	({ part, isPartSettled }: { part: GroupedMessagePart; isPartSettled: boolean }) => {
		if (isToolGroupPart(part)) {
			return <ToolCallsGroup parts={part.parts} isSettled={isPartSettled} />;
		}

		if (isQueryGroupPart(part)) {
			return <QueryGroup parts={part.parts} isSettled={isPartSettled} />;
		}

		if (isToolUIPart(part)) {
			return <ToolCall toolPart={part} />;
		}

		const isPartStreaming = !isPartSettled && 'state' in part && part.state === 'streaming';

		switch (part.type) {
			case 'text':
				return <AssistantTextWithCitation text={part.text} isStreaming={isPartStreaming} />;
			case 'reasoning':
				return <AssistantReasoning text={part.text} isStreaming={isPartStreaming} />;
			case 'data-compaction':
				return <AssistantCompaction part={part.data} />;
			default:
				return null;
		}
	},
	(previous, next) =>
		previous.isPartSettled === next.isPartSettled && areGroupedMessagePartsEqual(previous.part, next.part),
);
