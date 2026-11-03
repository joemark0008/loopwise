import { getRouteApi, Link, useNavigate } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import styles from './reset-password-page.module.css';
import { resetPassword } from '@/lib/auth-client';
import { AuthForm, FormTextField } from '@/feature/auth/components/auth-form';
import { useRedirectIfSmtpNotSetup } from '@/hooks/useRedirectIfSmtpNotSetup';

const Route = getRouteApi('/reset-password');

export function ResetPassword() {
	const isPending = useRedirectIfSmtpNotSetup();
	const navigate = useNavigate();
	const { token, error: tokenError } = Route.useSearch();
	const [serverError, setServerError] = useState<string | undefined>();

	const form = useForm({
		defaultValues: { newPassword: '', confirmPassword: '' },
		onSubmit: async ({ value }) => {
			if (value.newPassword !== value.confirmPassword) {
				setServerError('Passwords do not match.');
				return;
			}
			setServerError(undefined);
			const { error } = await resetPassword({ newPassword: value.newPassword, token: token! });
			if (error) {
				setServerError(error.message);
			} else {
				navigate({ to: '/login', search: { error: undefined, redirect: undefined } });
			}
		},
	});

	if (isPending) {
		return null;
	}

	if (tokenError === 'INVALID_TOKEN' || !token) {
		return (
			<div className={styles.resetPasswordDiv}>
				<h1 className={styles.resetPasswordH1}>Invalid or expired link</h1>
				<p className={styles.resetPasswordP}>
					This password reset link is no longer valid. Please request a new one.
				</p>
				<Link to='/forgot-password' className={styles.resetPasswordLink}>
					Request a new link
				</Link>
			</div>
		);
	}

	return (
		<AuthForm form={form} title='Reset password' submitText='Set new password' serverError={serverError}>
			<FormTextField
				form={form}
				name='newPassword'
				type='password'
				title='New password'
				className={styles.resetPasswordFormTextField}
			/>
			<FormTextField
				form={form}
				name='confirmPassword'
				type='password'
				title='Confirm new password'
				className={styles.resetPasswordFormTextField2}
			/>
		</AuthForm>
	);
}
