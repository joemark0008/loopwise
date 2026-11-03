import { getRouteApi, Link, useRouter } from '@tanstack/react-router';
import { CircleAlert } from 'lucide-react';
import styles from './email-verified-page.module.css';
import { AuthForm } from '@/feature/auth/components/auth-form';
import { Button } from '@/components/ui/button';
import { getEmailVerificationErrorMessage } from '@/lib/email-verification';
import { getSafeRedirectPath } from '@/lib/safe-redirect';

const Route = getRouteApi('/email-verified');

export function EmailVerified() {
	const router = useRouter();
	const { error, redirect } = Route.useSearch();
	const safeRedirect = getSafeRedirectPath(redirect);
	const isOAuthAuthorization = safeRedirect?.startsWith('/api/auth/oauth2/authorize?');
	const errorMessage = getEmailVerificationErrorMessage(error);

	if (error) {
		return (
			<AuthForm
				title='Email not verified'
				content={
					<div className={styles.emailVerifiedDiv}>
						<div className={styles.emailVerifiedDiv2}>
							<CircleAlert className={styles.emailVerifiedCircleAlert} aria-hidden='true' />
						</div>
						<p role='alert' className={styles.emailVerifiedP}>
							{errorMessage ?? 'We could not verify this email address. Log in to request a new link.'}
						</p>
						<Button asChild variant='outline' className={styles.emailVerifiedButton}>
							<Link to='/login' search={{ error: undefined, redirect: safeRedirect ?? undefined }}>
								Back to log in
							</Link>
						</Button>
					</div>
				}
			/>
		);
	}

	return (
		<AuthForm
			title='Email verified'
			titleClassName={styles.emailVerifiedAuthForm}
			content={
				<div className={styles.emailVerifiedDiv}>
					<div className={styles.emailVerifiedDiv3}>
						<p className={styles.emailVerifiedP2}>Your email address has been verified.</p>
						<p className={styles.emailVerifiedP3}>Return to your original tab, or continue here.</p>
					</div>
					{isOAuthAuthorization ? (
						<Button asChild variant='outline' className={styles.emailVerifiedButton}>
							<a href={safeRedirect ?? '/'}>Continue to Loopwise</a>
						</Button>
					) : (
						<Button
							type='button'
							variant='outline'
							className={styles.emailVerifiedButton}
							onClick={() => router.history.push(safeRedirect ?? '/')}
						>
							Continue to Loopwise
						</Button>
					)}
				</div>
			}
		/>
	);
}
