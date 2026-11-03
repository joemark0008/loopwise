import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { useEffect, useState } from 'react';
import styles from './set-password-page.module.css';
import type { PasswordLinkInfo } from '@/lib/password-link-api';
import { signIn } from '@/lib/auth-client';
import { AuthForm, FormTextField } from '@/feature/auth/components/auth-form';
import { Spinner } from '@/components/ui/spinner';
import { clearApolloCache } from '@/lib/apollo-client';
import { invalidateSession } from '@/lib/session';
import { rememberSignInMethod } from '@/lib/last-sign-in-method';
import { getPasswordLink, setPasswordWithLink } from '@/lib/password-link-api';
import { validateSetupPassword } from '@/feature/auth/setup-validation';

const Route = getRouteApi('/set-password');

type LinkState = { status: 'loading' } | { status: 'invalid' } | { status: 'valid'; info: PasswordLinkInfo };

/** Where a user lands from the link an admin gave them: their first password, or a reset. */
export function SetPassword() {
	const navigate = useNavigate();
	const { token } = Route.useSearch();
	const [link, setLink] = useState<LinkState>({ status: 'loading' });
	const [serverError, setServerError] = useState<string>();

	useEffect(() => {
		if (!token) {
			setLink({ status: 'invalid' });
			return;
		}
		let cancelled = false;
		getPasswordLink(token)
			.then((info) => !cancelled && setLink(info ? { status: 'valid', info } : { status: 'invalid' }))
			.catch(() => !cancelled && setLink({ status: 'invalid' }));
		return () => {
			cancelled = true;
		};
	}, [token]);

	const form = useForm({
		defaultValues: { password: '', confirmPassword: '' },
		onSubmit: async ({ value }) => {
			if (value.password !== value.confirmPassword) {
				setServerError('Passwords do not match.');
				return;
			}
			setServerError(undefined);
			const result = await setPasswordWithLink(token!, value.password);
			if (result.status === 'invalid-link') {
				setLink({ status: 'invalid' });
				return;
			}
			if (result.status === 'error') {
				setServerError(result.message);
				return;
			}

			const { error } = await signIn.email({ email: result.email, password: value.password });
			if (error) {
				navigate({
					to: '/login',
					search: { error: 'Your password is set. Log in with it.', redirect: undefined },
					replace: true,
				});
				return;
			}
			invalidateSession();
			rememberSignInMethod('email');
			// Cached results (`me`, public config) may belong to whoever used this browser before.
			await clearApolloCache();
			navigate({ to: '/' });
		},
	});

	if (link.status === 'loading') {
		return (
			<div className={styles.setPasswordMessage}>
				<Spinner />
			</div>
		);
	}

	if (link.status === 'invalid') {
		return (
			<div className={styles.setPasswordMessage}>
				<h1 className={styles.setPasswordH1}>Invalid or expired link</h1>
				<p className={styles.setPasswordP}>
					This link was already used or has expired. Ask your Loopwise admin for a new one.
				</p>
			</div>
		);
	}

	const { info } = link;
	return (
		<AuthForm
			form={form}
			title={info.isInvite ? 'Welcome to Loopwise' : 'Reset your password'}
			submitText={info.isInvite ? 'Set password and log in' : 'Reset password and log in'}
			serverError={serverError}
		>
			<p className={styles.setPasswordIntro}>
				{info.isInvite ? `Hi ${info.name}, choose a password` : 'Choose a new password'} for{' '}
				<strong>{info.email}</strong>.
			</p>
			<FormTextField
				form={form}
				name='password'
				type='password'
				title='Password'
				autoComplete='new-password'
				description='At least 8 characters.'
				validate={validateSetupPassword}
				className={styles.setPasswordFormTextField}
			/>
			<FormTextField
				form={form}
				name='confirmPassword'
				type='password'
				title='Confirm password'
				autoComplete='new-password'
				className={styles.setPasswordFormTextField2}
			/>
		</AuthForm>
	);
}
