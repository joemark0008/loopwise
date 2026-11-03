import { Pencil, Trash2 } from 'lucide-react';
import styles from './memory-item.module.css';
import type { UserMemoryRecord } from '@loopwise/api/agent/types/memory';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface SettingsMemoryItemProps {
	memory: UserMemoryRecord;
	onEdit: (memory: UserMemoryRecord) => void;
	onDelete: (memory: UserMemoryRecord) => void;
	className?: string;
}

export function SettingsMemoryItem({ memory, onEdit, onDelete, className }: SettingsMemoryItemProps) {
	const handleDelete = (e: React.MouseEvent) => {
		e.stopPropagation();
		onDelete(memory);
	};

	const handleEdit = (e: React.MouseEvent) => {
		e.stopPropagation();
		onEdit(memory);
	};

	return (
		<div className={cn(`${styles.settingsMemoryItemDiv} group`, className)}>
			<div className={styles.settingsMemoryItemDiv2}>{memory.content}</div>

			<div className={styles.settingsMemoryItemDiv3}>
				<Button variant='ghost-muted' size='icon-sm' onClick={handleEdit}>
					<Pencil />
				</Button>
				<Button variant='ghost-muted' size='icon-sm' onClick={handleDelete}>
					<Trash2 />
				</Button>
			</div>
		</div>
	);
}

export function SettingsMemorySkeleton({ className }: { className?: string }) {
	return (
		<div className={cn(styles.settingsMemorySkeletonDiv, className)}>
			<div className={styles.settingsMemorySkeletonDiv2}>
				<Skeleton className={styles.settingsMemorySkeletonSkeleton} />
				<Skeleton className={styles.settingsMemorySkeletonSkeleton2} />
			</div>
		</div>
	);
}
