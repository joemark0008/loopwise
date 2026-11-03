import { useCallback, useRef } from 'react';
import styles from './chat-messages-citation-chip.module.css';
import { useOptionalSelection } from '@/contexts/text-selection';
import { SelectionCitationExcerpt } from '@/feature/chat/components/selection-citation-excerpt';
import { createRangeFromOffsets, findTextRange } from '@/lib/selection-dom.utils';

interface ChatMessagesCitationChipProps {
	start: number;
	end: number;
	text: string;
}

export const ChatMessagesCitationChip = ({ start, end, text }: ChatMessagesCitationChipProps) => {
	const selectionCtx = useOptionalSelection();
	const buttonRef = useRef<HTMLButtonElement>(null);

	const handleClick = useCallback(() => {
		const container =
			selectionCtx?.containerRef.current ?? buttonRef.current?.closest<HTMLElement>('[data-selection-container]');
		if (!container) {
			return;
		}

		const range = createRangeFromOffsets(container, start, end) ?? findTextRange(container, text);
		if (!range) {
			return;
		}

		highlightRange(range);
	}, [selectionCtx, start, end, text]);

	return (
		<button ref={buttonRef} type='button' onClick={handleClick} className={styles.chatMessagesCitationChipButton}>
			<SelectionCitationExcerpt start={start} end={end} text={text} maxLength={80} lineClamp={2} />
		</button>
	);
};

function highlightRange(range: Range) {
	const ancestor = range.startContainer;
	const el = ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentElement : (ancestor as Element);
	if (el) {
		scrollToElement(el);
	}

	const sel = window.getSelection();
	sel?.removeAllRanges();
	sel?.addRange(range);
	setTimeout(() => sel?.removeAllRanges(), 2000);
}

function scrollToElement(el: Element) {
	const scrollParent = findScrollParent(el);
	if (scrollParent) {
		const rect = el.getBoundingClientRect();
		const parentRect = scrollParent.getBoundingClientRect();
		scrollParent.scrollTo({
			top: scrollParent.scrollTop + (rect.top - parentRect.top) - parentRect.height / 2,
			behavior: 'smooth',
		});
		return;
	}
	el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function findScrollParent(element: Element): Element | null {
	let current = element.parentElement;
	while (current) {
		const style = getComputedStyle(current);
		if (
			current.scrollHeight > current.clientHeight &&
			(style.overflowY === 'auto' || style.overflowY === 'scroll')
		) {
			return current;
		}
		current = current.parentElement;
	}
	return null;
}
