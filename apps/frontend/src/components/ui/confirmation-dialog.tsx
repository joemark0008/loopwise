import styles from './confirmation-dialog.module.css';
import type { ComponentProps } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ConfirmationDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: string;
	confirmLabel: string;
	onConfirm: () => void | Promise<void>;
	isPending?: boolean;
	error?: string;
	preventCloseWhilePending?: boolean;
	confirmVariant?: ComponentProps<typeof Button>['variant'];
}

export function ConfirmationDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel,
	onConfirm,
	isPending = false,
	error,
	preventCloseWhilePending = false,
	confirmVariant = 'destructive',
}: ConfirmationDialogProps) {
	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen && preventCloseWhilePending && isPending) {
			return;
		}
		onOpenChange(nextOpen);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>
				<DialogDescription className={styles.confirmationDialogDialogDescription}>
					{description}
				</DialogDescription>
				{error && <p className={styles.confirmationDialogP}>{error}</p>}
				<div className={styles.confirmationDialogDiv}>
					<Button
						variant='outline'
						className={styles.confirmationDialogButton}
						disabled={isPending}
						onClick={() => handleOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						variant={confirmVariant}
						className={styles.confirmationDialogButton2}
						disabled={isPending}
						isLoading={isPending}
						onClick={onConfirm}
					>
						{confirmLabel}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
