import { getRouteApi, Link, useNavigate, useRouter } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import styles from './login-page.module.css';
import { sendVerificationEmail, signIn } from '@/lib/auth-client';
import { AuthForm, FormTextField } from '@/feature/auth/components/auth-form';
import { EmailVerificationPending } from '@/feature/auth/components/email-verification-pending';
import {
	buildEmailVerificationCallbackUrl,
	getSignInErrorMessage,
	isEmailNotVerifiedError,
} from '@/lib/email-verification';
import { clearApolloCache } from '@/lib/apollo-client';
import { invalidateSession } from '@/lib/session';
import { rememberSignInMethod } from '@/lib/last-sign-in-method';
import { getSafeRedirectPath } from '@/lib/safe-redirect';
import { usePublicConfig, useSmtpSetup } from '@/hooks/use-public-config';

const Route = getRouteApi('/_public/login');

function buildOAuthAuthorizeUrl() {
	const params = new URLSearchParams(window.location.search);
	if (!params.has('client_id')) {
		return null;
	}
	return `/api/auth/oauth2/authorize${window.location.search}`;
}

export function Login() {
	const navigate = useNavigate();
	const router = useRouter();
	const { error: oauthError, redirect } = Route.useSearch();
	const [serverError, setServerError] = useState<string | undefined>(getSignInErrorMessage(oauthError));
	const [pendingEmail, setPendingEmail] = useState<string>();
	const isSmtpSetup = useSmtpSetup();
	const config = usePublicConfig();
	const isUserLoginEnabled = config.data?.enableUserLogin;

	const oauthAuthorizeUrl = buildOAuthAuthorizeUrl();
	const safeRedirect = getSafeRedirectPath(redirect);
	const verificationCallbackURL = buildEmailVerificationCallbackUrl(oauthAuthorizeUrl ?? safeRedirect);

	const form = useForm({
		defaultValues: { email: '', password: '' },
		onSubmit: async ({ value }) => {
			if (isUserLoginEnabled === false) {
				return;
			}
			setServerError(undefined);
			const { error } = await signIn.email(value);
			if (error) {
				if (isEmailNotVerifiedError(error)) {
					try {
						const { error: verificationError } = await sendVerificationEmail({
							email: value.email,
							callbackURL: verificationCallbackURL,
						});
						if (verificationError) {
							setServerError(
								verificationError.status === 429
									? 'Too many requests. Wait a minute before trying again.'
									: 'We could not send a verification email. Please try again.',
							);
							return;
						}
					} catch {
						setServerError('We could not send a verification email. Please try again.');
						return;
					}
					setPendingEmail(value.email);
					return;
				}
				setServerError(error.message);
				return;
			}

			invalidateSession();

			rememberSignInMethod('email');
			// Cached results (`me`, public config) belong to the previous visitor.
			await clearApolloCache();
			if (oauthAuthorizeUrl) {
				window.location.href = oauthAuthorizeUrl;
			} else if (safeRedirect) {
				router.history.push(safeRedirect);
			} else {
				navigate({ to: '/' });
			}
		},
	});

	return (
		<AuthForm
			form={form}
			title={pendingEmail ? 'Check your inbox' : 'Log in'}
			submitText='Log in'
			serverError={serverError}
			displaySocialProviders={!pendingEmail}
			socialCallbackUrl={oauthAuthorizeUrl ?? safeRedirect ?? undefined}
			displayEmailPasswordForm={isUserLoginEnabled}
			emailPasswordDisabledMessage='Email and password login is disabled. Use a configured sign-in provider to continue.'
			content={
				pendingEmail ? (
					<EmailVerificationPending
						email={pendingEmail}
						callbackURL={verificationCallbackURL}
						onChangeEmail={() => setPendingEmail(undefined)}
					/>
				) : undefined
			}
		>
			<FormTextField
				form={form}
				name='email'
				type='email'
				title='Email'
				placeholder='you@clinic.ph'
				autoComplete='username'
				className={styles.loginFormTextField}
			/>
			<FormTextField
				form={form}
				name='password'
				type='password'
				title='Password'
				autoComplete='current-password'
				className={
					isUserLoginEnabled && isSmtpSetup.data ? styles.loginFormTextField2 : styles.loginFormTextField3
				}
			/>
			{isUserLoginEnabled && isSmtpSetup.data && (
				<div className={styles.loginDiv}>
					<Link to='/forgot-password' className={styles.loginLink2}>
						Forgot password
					</Link>
				</div>
			)}
		</AuthForm>
	);
}
