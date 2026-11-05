import { useMutation } from '@apollo/client/react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import styles from './delete-clinic-dialog.module.css';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DeleteClinicDocument } from '@/graphql/generated/graphql';
import { setActiveClinicId } from '@/lib/active-clinic';
import { apolloClient } from '@/lib/apollo-client';

interface DeleteClinicDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	clinicId: string;
	clinicName: string;
}

/** loopwise: deletes the clinic once its name is typed back, then falls back to another clinic. */
export function DeleteClinicDialog({ open, onOpenChange, clinicId, clinicName }: DeleteClinicDialogProps) {
	const [confirmation, setConfirmation] = useState('');
	const [deleteClinic, { loading, error, reset }] = useMutation(DeleteClinicDocument);
	const queryClient = useQueryClient();
	const router = useRouter();
	const navigate = useNavigate();
	const canDelete = confirmation === clinicName && !loading;

	const handleOpenChange = (next: boolean) => {
		if (!next && loading) {
			return;
		}
		if (!next) {
			setConfirmation('');
			reset();
		}
		onOpenChange(next);
	};

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		if (!canDelete) {
			return;
		}
		const result = await deleteClinic({ variables: { clinicId } }).catch(() => null);
		if (!result?.data?.deleteClinic) {
			return;
		}
		// The API selects the user's next clinic when none is selected.
		setActiveClinicId(null);
		await Promise.all([apolloClient.resetStore(), queryClient.invalidateQueries(), router.invalidate()]);
		onOpenChange(false);
		await navigate({ to: '/' });
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<form onSubmit={handleSubmit} className={styles.deleteClinicDialogForm}>
					<DialogHeader>
						<DialogTitle>Delete clinic</DialogTitle>
						<DialogDescription>
							This permanently deletes <strong>{clinicName}</strong>, its chats, stories and settings.
							This cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<label className={styles.deleteClinicDialogLabel}>
						<span>
							Type <strong>{clinicName}</strong> to confirm.
						</span>
						<Input
							autoFocus
							autoComplete='off'
							value={confirmation}
							onChange={(event) => setConfirmation(event.target.value)}
							aria-label='Clinic name confirmation'
							disabled={loading}
						/>
					</label>
					{error && <p className={styles.deleteClinicDialogP}>{error.message}</p>}
					<DialogFooter>
						<Button
							type='button'
							variant='ghost'
							disabled={loading}
							onClick={() => handleOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type='submit' variant='destructive' disabled={!canDelete} isLoading={loading}>
							Delete clinic
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
