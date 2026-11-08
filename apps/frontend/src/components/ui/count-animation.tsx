import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useEffect } from 'react';

import { cn } from '@/lib/utils';

/** The kit's count-up for a stat: rolls from 0 to `number`, or shows it at once when motion is reduced. */
export function CountAnimation({ number, className }: { number: number; className?: string }) {
	const count = useMotionValue(0);
	const rounded = useTransform(count, Math.round);
	const reduceMotion = useReducedMotion();

	useEffect(() => {
		if (reduceMotion) {
			count.set(number);
			return;
		}
		const animation = animate(count, number, { duration: 1.2, ease: 'easeOut' });
		return animation.stop;
	}, [count, number, reduceMotion]);

	return <motion.span className={cn('tabular-nums', className)}>{rounded}</motion.span>;
}
