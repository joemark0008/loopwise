import { Check, HelpCircle } from 'lucide-react';
import { memo } from 'react';
import styles from './clarification.module.css';
import type { ToolCallComponentProps } from '.';
import type { UIMessage } from '@quarry/api/agent/types/chat';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgentContext, useAgentMessagesSelector } from '@/contexts/agent.provider';
import { useToolCallContext } from '@/contexts/tool-call';
import { getMessageText, isOnboardingContextRequestMessage, isToolUIPart } from '@/lib/ai';
import { cn } from '@/lib/utils';

type AnsweredState = { isAnswered: true; answer: string } | { isAnswered: false; answer?: undefined };

export const ClarificationToolCall = memo(({ toolPart }: ToolCallComponentProps<'clarification'>) => (
	<ClarificationQuestion
		toolCallId={toolPart.toolCallId}
		isStreaming={toolPart.state === 'input-streaming'}
		question={toolPart.input?.question}
		options={toolPart.input?.options}
	/>
));

function ClarificationQuestion({
	toolCallId,
	isStreaming,
	question,
	options: rawOptions,
}: {
	toolCallId: string;
	isStreaming: boolean;
	question: string | undefined;
	options: readonly unknown[] | undefined;
}) {
	const { isSettled } = useToolCallContext();
	const { queueOrSendMessage, isRunning } = useAgentContext();
	const answer = useAgentMessagesSelector((messages) => findAnswerForToolCall(messages, toolCallId));
	const answeredState: AnsweredState = answer !== null ? { isAnswered: true, answer } : { isAnswered: false };

	if (isStreaming && !question) {
		return <ClarificationSkeleton />;
	}

	if (!question) {
		return null;
	}

	const options: string[] =
		rawOptions?.flatMap((option) => {
			if (typeof option !== 'string') {
				return [];
			}
			const trimmed = option.trim();
			return trimmed ? [trimmed] : [];
		}) ?? [];

	const { isAnswered } = answeredState;
	const canSubmit = !isStreaming && isSettled && !isAnswered && !isRunning;

	const handleSelect = (option: string) => {
		if (!canSubmit) {
			return;
		}
		void queueOrSendMessage({ text: option });
	};

	return (
		<div className={cn(styles.clarificationQuestionDiv, isAnswered && styles.clarificationQuestionDiv2)}>
			<div className={styles.clarificationQuestionDiv3}>
				<HelpCircle size={16} className={styles.clarificationQuestionHelpCircle} />
				<div className={styles.clarificationQuestionDiv4}>
					<span className={styles.clarificationQuestionSpan}>
						{isAnswered ? 'Answered' : 'Quick question'}
					</span>
					<p className={styles.clarificationQuestionP}>{question}</p>
				</div>
			</div>

			{options.length > 0 && (
				<div className={styles.clarificationQuestionDiv5}>
					{options.map((option, index) => {
						const isSelected =
							isAnswered && answeredState.answer.trim().toLowerCase() === option.trim().toLowerCase();
						return (
							<Button
								key={`${index}-${option}`}
								variant={isSelected ? 'secondary' : 'outline'}
								size='sm'
								disabled={!canSubmit && !isSelected}
								onClick={() => handleSelect(option)}
								className={styles.clarificationQuestionButton}
							>
								{isSelected && <Check className={styles.clarificationQuestionCheck} />}
								<span className={styles.clarificationQuestionSpan2}>{option}</span>
							</Button>
						);
					})}
				</div>
			)}

			{!isAnswered && (
				<p className={styles.clarificationQuestionP2}>
					{options.length > 0
						? 'Click an option to send it, or type your own answer below.'
						: 'Type your answer below.'}
				</p>
			)}
		</div>
	);
}

/**
 * Find whether the user has already answered this clarification turn by
 * looking for a user message that appears after the assistant message
 * containing this tool call.
 */
export function findAnswerForToolCall(messages: UIMessage[], toolCallId: string): string | null {
	const toolMessageIndex = messages.findIndex((message) =>
		message.parts.some((part) => isToolUIPart(part) && part.toolCallId === toolCallId),
	);
	if (toolMessageIndex === -1) {
		return null;
	}

	for (let i = toolMessageIndex + 1; i < messages.length; i++) {
		const message = messages[i];
		if (message.role === 'user' && !isOnboardingContextRequestMessage(message)) {
			return getMessageText(message).trim();
		}
	}

	return null;
}

const ClarificationSkeleton = () => (
	<div className={styles.clarificationQuestionDiv}>
		<div className={styles.clarificationQuestionDiv3}>
			<HelpCircle size={16} className={styles.clarificationSkeletonHelpCircle} />
			<div className={styles.clarificationSkeletonDiv}>
				<Skeleton className={styles.clarificationSkeletonSkeleton} />
				<Skeleton className={styles.clarificationSkeletonSkeleton2} />
			</div>
		</div>
		<div className={styles.clarificationQuestionDiv5}>
			{Array.from({ length: 3 }).map((_, idx) => (
				<Skeleton key={idx} className={styles.clarificationSkeletonSkeleton3} />
			))}
		</div>
	</div>
);
