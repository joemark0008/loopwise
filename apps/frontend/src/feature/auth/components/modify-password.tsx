import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@apollo/client/react';
import { AuthForm, FormTextField } from './auth-form';
import styles from './modify-password.module.css';
import { useSession } from '@/lib/auth-client';
import { ModifyPasswordDocument } from '@/graphql/generated/graphql';

export function ModifyPassword() {
	const { refetch } = useSession();
	const [serverError, setServerError] = useState<string | undefined>();

	const [modifyPassword, { loading: isUpdating }] = useMutation(ModifyPasswordDocument);

	const form = useForm({
		defaultValues: { newPassword: '', confirmPassword: '' },
		onSubmit: async ({ value }) => {
			if (value.newPassword !== value.confirmPassword) {
				setServerError('Passwords do not match');
				return;
			}
			setServerError(undefined);
			try {
				await modifyPassword({
					variables: { input: { newPassword: value.newPassword, confirmPassword: value.confirmPassword } },
				});
				await refetch();
			} catch (err) {
				setServerError(err instanceof Error ? err.message : String(err));
			}
		},
	});

	return (
		<div className={styles.modifyPasswordDiv}>
			<AuthForm
				form={form}
				title='Change your password to secure your account'
				submitText={isUpdating ? 'Updating...' : 'Reset password'}
				serverError={serverError}
			>
				<FormTextField
					form={form}
					name='newPassword'
					type='password'
					title='New password'
					className={styles.modifyPasswordFormTextField}
				/>
				<FormTextField
					form={form}
					name='confirmPassword'
					type='password'
					title='Confirm new password'
					className={styles.modifyPasswordFormTextField2}
				/>
			</AuthForm>
		</div>
	);
}
