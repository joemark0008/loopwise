import { Link } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import styles from './forgot-password-page.module.css';
import { requestPasswordReset } from '@/lib/auth-client';
import { AuthForm, FormTextField } from '@/feature/auth/components/auth-form';
import { useRedirectIfSmtpNotSetup } from '@/hooks/useRedirectIfSmtpNotSetup';

export function ForgotPassword() {
	const isPending = useRedirectIfSmtpNotSetup();
	const [submitted, setSubmitted] = useState(false);
	const [serverError, setServerError] = useState<string | undefined>();

	const form = useForm({
		defaultValues: { email: '' },
		onSubmit: async ({ value }) => {
			setServerError(undefined);
			const { error } = await requestPasswordReset({
				email: value.email,
				redirectTo: `${window.location.origin}/reset-password`,
			});
			if (error) {
				setServerError(error.message);
			} else {
				setSubmitted(true);
			}
		},
	});

	if (isPending) {
		return null;
	}

	if (submitted) {
		return (
			<div className={styles.forgotPasswordDiv}>
				<h1 className={styles.forgotPasswordH1}>Check your inbox</h1>
				<p className={styles.forgotPasswordP}>
					If an account exists for that email, we sent a password reset link. Check your spam folder if you
					don't see it.
				</p>
				<Link
					to='/login'
					search={{ error: undefined, redirect: undefined }}
					className={styles.forgotPasswordLink}
				>
					Back to login
				</Link>
			</div>
		);
	}

	return (
		<AuthForm form={form} title='Forgot password' submitText='Send reset link' serverError={serverError}>
			<FormTextField
				form={form}
				name='email'
				type='email'
				title='Email'
				placeholder='joe@gmail.com'
				className={styles.forgotPasswordFormTextField}
			/>
			<div className={styles.forgotPasswordDiv2}>
				<Link
					to='/login'
					search={{ error: undefined, redirect: undefined }}
					className={styles.forgotPasswordLink}
				>
					Back to login
				</Link>
			</div>
		</AuthForm>
	);
}
