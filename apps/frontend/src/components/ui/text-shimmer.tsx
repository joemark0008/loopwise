import { useMemo } from 'react';

import styles from './text-shimmer.module.css';
import LoopwiseLogoAnimated from '@/components/icons/loopwise-logo-animated';
import { cn } from '@/lib/utils';

const DEFAULT_WORDS = ['Crunching', 'Analyzing', 'Thinking'];

export const TextShimmer = ({
	className,
	text,
	showLogo = false,
}: {
	className?: string;
	text?: string;
	showLogo?: boolean;
}) => {
	const randomWord = useMemo(() => DEFAULT_WORDS[Math.floor(Math.random() * DEFAULT_WORDS.length)], []);
	const label = text ?? randomWord;

	return (
		<div className={cn(styles.textShimmerDiv, className)}>
			{showLogo && <LoopwiseLogoAnimated height={12} width={12} durationSeconds={2.2} title='' />}
			<span className={styles.textShimmerSpan}>{label}</span>
		</div>
	);
};
