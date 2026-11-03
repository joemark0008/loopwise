import { useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert } from 'lucide-react';

import styles from './email-verification-pending.module.css';
import { Button } from '@/components/ui/button';
import { sendVerificationEmail } from '@/lib/auth-client';

interface EmailVerificationPendingProps {
	email: string;
	callbackURL: string;
	onChangeEmail?: () => void;
}

interface Feedback {
	message: string;
	type: 'success' | 'error';
}

const RESEND_COOLDOWN_SECONDS = 15;

export function EmailVerificationPending({ email, callbackURL, onChangeEmail }: EmailVerificationPendingProps) {
	const [feedback, setFeedback] = useState<Feedback>();
	const [isSending, setIsSending] = useState(false);
	const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);

	useEffect(() => {
		if (resendCooldown === 0) {
			return;
		}
		const timeout = window.setTimeout(() => setResendCooldown((seconds) => seconds - 1), 1000);
		return () => window.clearTimeout(timeout);
	}, [resendCooldown]);

	const resend = async () => {
		setFeedback(undefined);
		setIsSending(true);
		setResendCooldown(RESEND_COOLDOWN_SECONDS);
		try {
			const { error } = await sendVerificationEmail({ email, callbackURL });
			setFeedback({
				type: error ? 'error' : 'success',
				message: error
					? error.status === 429
						? 'Too many requests. Wait a minute before trying again.'
						: 'We could not send another verification email. Please try again.'
					: 'Another email is on its way.',
			});
		} catch {
			setFeedback({
				type: 'error',
				message: 'We could not send another verification email. Please try again.',
			});
		} finally {
			setIsSending(false);
		}
	};

	return (
		<div className={styles.emailVerificationPendingDiv}>
			<div className={styles.emailVerificationPendingDiv2}>
				<p className={styles.emailVerificationPendingP}>We sent an email to</p>
				<p className={styles.emailVerificationPendingP2}>{email}</p>
				<p className={styles.emailVerificationPendingP3}>
					Click the link in it to continue to Loopwise. Verification links expire in one hour.
				</p>
			</div>

			<Button
				type='button'
				variant='outline'
				className={styles.emailVerificationPendingButton}
				isLoading={isSending}
				disabled={isSending || resendCooldown > 0}
				onClick={resend}
			>
				{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend email'}
			</Button>
			{feedback && (
				<div
					role={feedback.type === 'error' ? 'alert' : 'status'}
					className={styles.emailVerificationPendingDiv3}
				>
					{feedback.type === 'success' ? (
						<CheckCircle2 className={styles.emailVerificationPendingCheckCircle2} />
					) : (
						<CircleAlert className={styles.emailVerificationPendingCircleAlert} />
					)}
					<span>{feedback.message}</span>
				</div>
			)}
			{onChangeEmail && (
				<p className={styles.emailVerificationPendingP4}>
					Wrong email?{' '}
					<button
						type='button'
						aria-label='Use a different email'
						className={styles.emailVerificationPendingButton2}
						onClick={onChangeEmail}
					>
						Change it
					</button>
				</p>
			)}
		</div>
	);
}
