import { Pencil, Trash2 } from 'lucide-react';
import styles from './saved-prompt.module.css';
import type { SavedPrompt } from '@/lib/api-types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface SavedPromptProps {
	prompt: SavedPrompt;
	onEdit: (id: string) => void;
	onDelete: (id: string) => void;
	className?: string;
}

export function SavedPromptItem({ prompt, onEdit, onDelete, className }: SavedPromptProps) {
	const handleDelete = (e: React.MouseEvent) => {
		e.stopPropagation();
		onDelete(prompt.id);
	};

	const handleEdit = (e: React.MouseEvent) => {
		e.stopPropagation();
		onEdit(prompt.id);
	};

	return (
		<div className={cn(`${styles.savedPromptItemDiv} group`, className)} onClick={() => onEdit(prompt.id)}>
			<div className={styles.savedPromptItemDiv2}>
				<div className={styles.savedPromptItemDiv3}>
					<span className={styles.savedPromptItemSpan}>{prompt.title || 'Untitled Prompt'}</span>
				</div>
				<div className={styles.savedPromptItemDiv4}>{prompt.prompt}</div>
			</div>

			<div className={styles.savedPromptItemDiv5}>
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

export function SavedPromptSkeleton({ className }: { className?: string }) {
	return (
		<div className={cn(styles.savedPromptSkeletonDiv, className)}>
			<div className={styles.savedPromptSkeletonDiv2}>
				<Skeleton className={styles.savedPromptSkeletonSkeleton} />
				<Skeleton className={styles.savedPromptSkeletonSkeleton2} />
			</div>
		</div>
	);
}
