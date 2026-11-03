import styles from './confetti-burst.module.css';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

const DEFAULT_CONFETTI_COLORS = [
	'var(--chart-1)',
	'var(--chart-2)',
	'var(--chart-3)',
	'var(--chart-4)',
	'var(--chart-5)',
	'var(--chart-6)',
	'var(--chart-7)',
];

interface ConfettiBurstProps {
	count?: number;
	distancePx?: number;
	distanceStepPx?: number;
	delayMs?: number;
	colors?: string[];
	pieceClassName?: string;
	className?: string;
}

export function ConfettiBurst({
	count = 14,
	distancePx = 70,
	distanceStepPx = 18,
	delayMs = 0,
	colors = DEFAULT_CONFETTI_COLORS,
	pieceClassName = styles.state100,
	className,
}: ConfettiBurstProps) {
	return (
		<div aria-hidden='true' className={cn(styles.confettiBurstDiv, className)}>
			{Array.from({ length: count }, (_, index) => {
				const style = {
					'--angle': `${(360 / count) * index}deg`,
					'--distance': `${distancePx + (index % 3) * distanceStepPx}px`,
					'--delay': `${delayMs + (index % 4) * 40}ms`,
					backgroundColor: colors[index % colors.length],
				} as CSSProperties;
				return (
					<span
						key={index}
						style={style}
						className={cn(
							`${styles.confettiBurstSpan} confetti-piece`,
							pieceClassName,
							index % 2 ? styles.confettiBurstSpan2 : styles.confettiBurstSpan3,
						)}
					/>
				);
			})}
		</div>
	);
}
