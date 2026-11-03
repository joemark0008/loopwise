import styles from './empty.module.css';
import { cn } from '@/lib/utils';

interface EmptyProps {
	children: React.ReactNode;
	className?: string;
}

export function Empty({ children, className }: EmptyProps) {
	return <div className={cn(styles.emptyDiv, className)}>{children}</div>;
}
