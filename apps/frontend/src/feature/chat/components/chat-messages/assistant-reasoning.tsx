import { memo, useEffect, useRef, useState } from 'react';
import { Streamdown } from 'streamdown';
import { StreamingMarkdown } from './streaming-markdown';
import styles from './assistant-reasoning.module.css';
import { Conversation, ConversationContent } from '@/components/ui/conversation';
import { Expandable } from '@/components/ui/expandable';
import { markdownPlugins } from '@/lib/markdown';
import { markdownLinkSafety } from '@/components/external-link-dialog';

interface AssistantReasoningProps {
	text: string;
	isStreaming: boolean;
}

export const AssistantReasoning = memo(({ text, isStreaming }: AssistantReasoningProps) => {
	const [isExpanded, setIsExpanded] = useState(isStreaming);
	const wasStreamingRef = useRef(isStreaming);

	useEffect(() => {
		if (isStreaming && !wasStreamingRef.current) {
			setIsExpanded(true);
		} else if (!isStreaming && wasStreamingRef.current) {
			setIsExpanded(false);
		}
		wasStreamingRef.current = isStreaming;
	}, [isStreaming]);

	const hasText = text.trim() !== '';
	if (!isStreaming && !hasText) {
		return null;
	}

	return (
		<Expandable
			title={isStreaming ? 'Thinking' : 'Thought'}
			expanded={isExpanded && hasText}
			onExpandedChange={setIsExpanded}
			disabled={!hasText}
			isLoading={isStreaming}
		>
			<div className={styles.assistantReasoningDiv}>
				<Conversation className={styles.assistantReasoningConversation}>
					<ConversationContent
						className={styles.assistantReasoningConversation}
						scrollClassName={styles.assistantReasoningConversationContent}
					>
						{isStreaming ? (
							<StreamingMarkdown text={text} />
						) : (
							<Streamdown
								linkSafety={markdownLinkSafety}
								isAnimating={isStreaming}
								mode={isStreaming ? 'streaming' : 'static'}
								plugins={markdownPlugins}
							>
								{text}
							</Streamdown>
						)}
					</ConversationContent>
				</Conversation>
			</div>
		</Expandable>
	);
});
