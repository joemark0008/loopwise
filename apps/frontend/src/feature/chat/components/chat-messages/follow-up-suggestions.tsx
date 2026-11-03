import { CornerDownRight } from 'lucide-react';
import styles from './follow-up-suggestions.module.css';
import type { UIToolPart } from '@loopwise/api/agent/types/chat';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSetChatInputCallback } from '@/contexts/set-chat-input-callback';
import { cn } from '@/lib/utils';

export const FollowUpSuggestions = ({ toolPart }: { toolPart: UIToolPart<'suggest_follow_ups'> }) => {
	const setPromptCallback = useSetChatInputCallback();

	if (!toolPart.input) {
		return null;
	}

	if (toolPart.state === 'input-streaming') {
		return (
			<div key={'skeleton'} className={styles.followUpSuggestionsDiv}>
				{Array.from({ length: 3 }).map((_, idx) => (
					<div className={styles.followUpSuggestionsDiv2} key={idx}>
						<CornerDownRight size={16} className={styles.followUpSuggestionsCornerDownRight} />
						<Skeleton key={idx} className={styles.followUpSuggestionsSkeleton} />
					</div>
				))}
			</div>
		);
	}

	if (toolPart.input.suggestions.length === 0) {
		return null;
	}

	return (
		<div key={'suggestions'} className={cn(styles.followUpSuggestionsDiv3, styles.followUpSuggestionsDiv4)}>
			<p className={styles.followUpSuggestionsP}>
				Pick a suggestion below to keep going, or ask me anything else.
			</p>
			{toolPart.input.suggestions.map((suggestion, index) => (
				<Button
					key={index}
					variant='ghost'
					onClick={() => setPromptCallback.fire(suggestion)}
					className={styles.followUpSuggestionsButton}
				>
					<CornerDownRight className={styles.followUpSuggestionsCornerDownRight2} />
					<span className={styles.followUpSuggestionsSpan}>{suggestion}</span>
				</Button>
			))}
		</div>
	);
};
