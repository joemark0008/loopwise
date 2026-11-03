import { memo, useState } from 'react';
import { Streamdown } from 'streamdown';
import styles from './assistant-compaction.module.css';
import type { CompactionPart } from '@loopwise/api/agent/types/chat';
import { Conversation, ConversationContent } from '@/components/ui/conversation';
import { ErrorMessage } from '@/components/ui/error-message';
import { TextShimmer } from '@/components/ui/text-shimmer';
import { Expandable } from '@/components/ui/expandable';
import { markdownLinkSafety } from '@/components/external-link-dialog';

export const AssistantCompaction = memo(({ part }: { part?: CompactionPart }) => {
	const [isExpanded, setIsExpanded] = useState(false);

	if (!part) {
		return <TextShimmer showLogo text='Compacting conversation' />;
	}

	const title = part.error ? 'Compaction failed' : 'Compacted conversation';

	return (
		<Expandable title={title} expanded={isExpanded} onExpandedChange={setIsExpanded}>
			<div className={styles.assistantCompactionDiv}>
				<Conversation className={styles.assistantCompactionConversation}>
					<ConversationContent
						className={styles.assistantCompactionConversation}
						scrollClassName={styles.assistantCompactionConversationContent}
					>
						{part.error ? (
							<ErrorMessage message={part.error} />
						) : (
							<Streamdown linkSafety={markdownLinkSafety} mode='static'>
								{part.summary}
							</Streamdown>
						)}
					</ConversationContent>
				</Conversation>
			</div>
		</Expandable>
	);
});
