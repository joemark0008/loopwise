import { useMutation } from '@apollo/client/react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import styles from './create-clinic-dialog.module.css';
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
import { CreateClinicDocument } from '@/graphql/generated/graphql';
import { setActiveClinicId } from '@/lib/active-clinic';
import { apolloClient } from '@/lib/apollo-client';

interface CreateClinicDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/** loopwise: creates a clinic (its own context folder), selects it and opens its warehouse settings. */
export function CreateClinicDialog({ open, onOpenChange }: CreateClinicDialogProps) {
	const [name, setName] = useState('');
	const [createClinic, { loading, error, reset }] = useMutation(CreateClinicDocument);
	const queryClient = useQueryClient();
	const router = useRouter();
	const navigate = useNavigate();

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setName('');
			reset();
		}
		onOpenChange(next);
	};

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		const result = await createClinic({ variables: { input: { name: name.trim() } } }).catch(() => null);
		const clinic = result?.data?.createClinic;
		if (!clinic) {
			return;
		}
		setActiveClinicId(clinic.id);
		await Promise.all([apolloClient.resetStore(), queryClient.invalidateQueries(), router.invalidate()]);
		handleOpenChange(false);
		await navigate({ to: '/settings/clinic' });
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<form onSubmit={handleSubmit} className={styles.createClinicDialogForm}>
					<DialogHeader>
						<DialogTitle>New clinic</DialogTitle>
						<DialogDescription>
							A clinic location has its own visits, invoices, stock, staff roles and AI settings.
						</DialogDescription>
					</DialogHeader>
					<Input
						autoFocus
						placeholder='Clinic name'
						value={name}
						maxLength={100}
						onChange={(event) => setName(event.target.value)}
						aria-label='Clinic name'
					/>
					{error && <p className={styles.createClinicDialogP}>{error.message}</p>}
					<DialogFooter>
						<Button type='button' variant='ghost' onClick={() => handleOpenChange(false)}>
							Cancel
						</Button>
						<Button type='submit' disabled={!name.trim() || loading}>
							{loading ? 'Creating…' : 'Create clinic'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
