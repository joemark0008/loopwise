import styles from './skeleton.module.css';
import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
	return <div data-slot='skeleton' className={cn(styles.skeletonDiv, className)} {...props} />;
}

export { Skeleton };
