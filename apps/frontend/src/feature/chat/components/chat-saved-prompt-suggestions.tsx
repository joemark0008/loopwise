import { CornerDownRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import styles from './chat-saved-prompt-suggestions.module.css';
import type { SavedPrompt } from '@/lib/api-types';
import { Button } from '@/components/ui/button';
import { useSetChatInputCallback } from '@/contexts/set-chat-input-callback';
import { useSavedPromptsQuery } from '@/hooks/use-saved-prompts';
import { pickUniqueFrom } from '@/lib/random';
import { cn } from '@/lib/utils';

const SHOW_DURATION = 8_000;
const ANIMATION_DURATION = 600;
const ANIMATION_DELAY = 50;

export function SavedPromptSuggestions({ projectId }: { projectId?: string }) {
	const setPromptCallback = useSetChatInputCallback();
	const { data: savedPrompts } = useSavedPromptsQuery(projectId);
	const { displayedPrompts, animationKey, hidePrompts, pause, resume } = usePromptRotation(savedPrompts, 3);

	if (displayedPrompts.length === 0) {
		return null;
	}

	return (
		<div className={styles.savedPromptSuggestionsDiv} key={animationKey} onMouseEnter={pause} onMouseLeave={resume}>
			<span className={styles.savedPromptSuggestionsSpan}>Suggested ideas based on your data set</span>
			{displayedPrompts.map((prompt, index) => (
				<Button
					key={index}
					variant='ghost'
					onClick={() => setPromptCallback.fire(prompt.prompt)}
					style={{
						animationDelay: `${index * ANIMATION_DELAY}ms`,
						animationDuration: `${ANIMATION_DURATION}ms`,
					}}
					className={cn(
						`${styles.savedPromptSuggestionsButton} group`,
						hidePrompts ? styles.savedPromptSuggestionsButton2 : styles.savedPromptSuggestionsButton3,
					)}
				>
					<CornerDownRight size={14} className={styles.savedPromptSuggestionsCornerDownRight} />
					<span className={styles.savedPromptSuggestionsSpan2}>{prompt.title}</span>
				</Button>
			))}
		</div>
	);
}

function usePromptRotation(savedPrompts: SavedPrompt[] | undefined, n: number) {
	const [displayedPrompts, setDisplayedPrompts] = useState<SavedPrompt[]>([]);
	const [animationKey, setAnimationKey] = useState(0);
	const [paused, setPaused] = useState(false);
	const [hidePrompts, setHidePrompts] = useState(false);

	useEffect(() => {
		if (!savedPrompts || savedPrompts.length <= n) {
			setHidePrompts(false);
			return setDisplayedPrompts(savedPrompts ?? []);
		}

		setDisplayedPrompts((prev) => (prev.length === 0 ? pickUniqueFrom(savedPrompts, n) : prev));

		if (paused) {
			return;
		}

		let hideTimeout: NodeJS.Timeout | undefined;

		const scheduleHide = () => {
			clearTimeout(hideTimeout);
			hideTimeout = setTimeout(
				() => {
					setHidePrompts(true);
				},
				SHOW_DURATION - ANIMATION_DELAY * n,
			);
		};

		scheduleHide();

		const interval = setInterval(() => {
			setDisplayedPrompts(pickUniqueFrom(savedPrompts, n));
			setAnimationKey((prev) => prev + 1);
			setHidePrompts(false);
			scheduleHide();
		}, SHOW_DURATION + ANIMATION_DURATION);

		return () => {
			clearInterval(interval);
			clearTimeout(hideTimeout);
		};
	}, [savedPrompts, paused, n]);

	const pause = useCallback(() => {
		setPaused(true);
		setHidePrompts(false);
	}, []);

	const resume = useCallback(() => {
		setPaused(false);
		setHidePrompts(false);
	}, []);

	return { displayedPrompts, animationKey, hidePrompts, pause, resume };
}
