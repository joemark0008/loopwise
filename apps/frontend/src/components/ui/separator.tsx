import styles from './overlay.module.css';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

function Separator({
	className,
	orientation = 'horizontal',
	...props
}: ComponentProps<'div'> & { orientation?: 'horizontal' | 'vertical' }) {
	return (
		<div
			role='none'
			data-slot='separator'
			data-orientation={orientation}
			className={cn(styles.separator, className)}
			{...props}
		/>
	);
}

export { Separator };
