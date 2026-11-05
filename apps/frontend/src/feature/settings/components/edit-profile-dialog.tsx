import { useState, useEffect } from 'react';
import { useForm } from '@tanstack/react-form';

import styles from './edit-profile-dialog.module.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface EditProfileDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	name: string | undefined;
	onSubmit: (name: string) => Promise<void>;
}

/** The signed-in user's name. Roles are managed with clinic members, which come back with Phase 6. */
export function EditProfileDialog({ open, onOpenChange, name, onSubmit }: EditProfileDialogProps) {
	const [error, setError] = useState('');

	const form = useForm({
		defaultValues: { name: name ?? '' },
		onSubmit: async ({ value }) => {
			setError('');
			try {
				await onSubmit(value.name);
				onOpenChange(false);
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			}
		},
	});

	useEffect(() => {
		if (open) {
			form.reset();
			form.setFieldValue('name', name ?? '');
		}
	}, [open, name, form]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Edit Profile</DialogTitle>
				</DialogHeader>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					className={styles.editProfileDialogForm}
				>
					<form.Field name='name'>
						{(field) => (
							<div className={styles.editProfileDialogDiv}>
								<label htmlFor='edit-profile-name' className={styles.editProfileDialogLabel}>
									Name
								</label>
								<Input
									id='edit-profile-name'
									type='text'
									placeholder='Name'
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</div>
						)}
					</form.Field>

					{error && <p className={styles.editProfileDialogP}>{error}</p>}
					<div className={styles.editProfileDialogDiv2}>
						<Button type='submit' variant='primary-gradient' className={styles.editProfileDialogButton}>
							Validate changes
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
