import { useMutation } from '@apollo/client/react';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';

import styles from './change-password-dialog.module.css';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormTextField } from '@/feature/auth/components/auth-form';
import { validateSetupPassword } from '@/feature/auth/setup-validation';
import { ChangePasswordDocument } from '@/graphql/generated/graphql';

interface ChangePasswordDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onChanged: () => void;
}

/** The signed-in user's own password change. A forgotten password is reset by an admin instead. */
export function ChangePasswordDialog({ open, onOpenChange, onChanged }: ChangePasswordDialogProps) {
	const [changePassword] = useMutation(ChangePasswordDocument);
	const [serverError, setServerError] = useState<string>();

	const form = useForm({
		defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
		onSubmit: async ({ value }) => {
			if (value.newPassword !== value.confirmPassword) {
				setServerError('Passwords do not match.');
				return;
			}
			setServerError(undefined);
			try {
				await changePassword({
					variables: { input: { currentPassword: value.currentPassword, newPassword: value.newPassword } },
				});
				form.reset();
				onOpenChange(false);
				onChanged();
			} catch (error) {
				setServerError(error instanceof Error ? error.message : String(error));
			}
		},
	});

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) {
					form.reset();
					setServerError(undefined);
				}
				onOpenChange(next);
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Change password</DialogTitle>
					<DialogDescription>
						You stay signed in here. Your other browsers and devices are signed out.
					</DialogDescription>
				</DialogHeader>
				<form
					className={styles.changePasswordForm}
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						void form.handleSubmit();
					}}
				>
					<FormTextField
						form={form}
						name='currentPassword'
						type='password'
						title='Current password'
						autoComplete='current-password'
					/>
					<FormTextField
						form={form}
						name='newPassword'
						type='password'
						title='New password'
						autoComplete='new-password'
						description='At least 8 characters.'
						validate={validateSetupPassword}
					/>
					<FormTextField
						form={form}
						name='confirmPassword'
						type='password'
						title='Confirm new password'
						autoComplete='new-password'
					/>
					{serverError && <p className={styles.changePasswordError}>{serverError}</p>}
					<form.Subscribe selector={(state) => state.isSubmitting}>
						{(isSubmitting) => (
							<Button type='submit' variant='primary-gradient' disabled={isSubmitting}>
								{isSubmitting ? 'Changing…' : 'Change password'}
							</Button>
						)}
					</form.Subscribe>
				</form>
			</DialogContent>
		</Dialog>
	);
}
