import { useState } from 'react';
import styles from './encounter.module.css';
import { FormField } from './form-field';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';

/**
 * Asks why an entry or document is voided. Voided rows stay in the record, struck through; nothing is deleted. Also
 * asks the reason for rejecting or cancelling an order (`actionLabel`).
 */
export function VoidDialog({
	open,
	onOpenChange,
	title,
	description,
	onVoid,
	isPending,
	error,
	actionLabel = 'Void',
	placeholder = 'Entered in error',
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: string;
	onVoid: (reason: string) => void;
	isPending: boolean;
	error?: string;
	actionLabel?: string;
	placeholder?: string;
}) {
	const [reason, setReason] = useState('');
	const tooShort = reason.trim().length < 3;

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) {
					setReason('');
				}
				onOpenChange(next);
			}}
		>
			<DialogContent>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						if (!tooShort) {
							onVoid(reason.trim());
						}
					}}
					className={styles.section}
				>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription>{description}</DialogDescription>
					</DialogHeader>
					<FormField label='Reason'>
						{(id) => (
							<Input
								id={id}
								value={reason}
								placeholder={placeholder}
								onChange={(event) => setReason(event.target.value)}
								disabled={isPending}
							/>
						)}
					</FormField>
					{error && <ErrorMessage message={error} />}
					<DialogFooter>
						<Button type='button' variant='ghost-muted' onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button type='submit' variant='destructive' disabled={isPending || tooShort}>
							{actionLabel}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
