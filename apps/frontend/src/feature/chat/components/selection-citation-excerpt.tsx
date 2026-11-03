import styles from './selection-citation-excerpt.module.css';
import type { StoryBlockReference } from '@loopwise/shared/types';
import { cn } from '@/lib/utils';

interface SelectionCitationExcerptProps {
	label?: string;
	start?: number;
	end?: number;
	block?: StoryBlockReference;
	text: string;
	maxLength?: number;
	lineClamp?: 2 | 3;
}

export function SelectionCitationExcerpt({
	label,
	start,
	end,
	block,
	text,
	maxLength = 220,
	lineClamp = 3,
}: SelectionCitationExcerptProps) {
	const displayed = maxLength > 0 && text.length > maxLength ? `${text.slice(0, maxLength)}\u2026` : text;

	return (
		<>
			<p className={styles.selectionCitationExcerptP}>{label ?? describeLabel(start, end, block)}</p>
			{displayed && (
				<blockquote
					className={cn(
						styles.selectionCitationExcerptBlockquote,
						lineClamp === 2
							? styles.selectionCitationExcerptBlockquote2
							: styles.selectionCitationExcerptBlockquote3,
					)}
				>
					&ldquo;{displayed}&rdquo;
				</blockquote>
			)}
		</>
	);
}

function describeLabel(start?: number, end?: number, block?: StoryBlockReference) {
	return block ? `@${block.kind} block` : `@chars ${start}\u2013${end}`;
}
