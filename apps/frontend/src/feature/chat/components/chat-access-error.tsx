import { Link } from '@tanstack/react-router';
import { Lock, SearchX, TriangleAlert, WifiOff } from 'lucide-react';

import styles from './chat-access-error.module.css';
import { MobileHeader } from '@/layout/mobile-header';
import { Button } from '@/components/ui/button';
import { getSafeRedirectPath } from '@/lib/safe-redirect';
import { isForbiddenError, isInternalServerError, isNotFoundError, isUnauthorizedError } from '@/lib/api-error';

export function ChatAccessError({
	error,
	onRetry,
	chatId,
}: {
	error?: unknown;
	onRetry?: () => void;
	chatId?: string;
}) {
	if (isNotFoundError(error)) {
		return (
			<ChatErrorLayout
				icon={<SearchX className={styles.chatAccessErrorSearchX} aria-hidden />}
				title='Chat not found'
				description='This chat may have been deleted, moved, or you may not have access to it.'
			>
				<Button asChild variant='secondary'>
					<Link to='/'>Start a new chat</Link>
				</Button>
			</ChatErrorLayout>
		);
	}

	if (isUnauthorizedError(error)) {
		const redirect = getSafeRedirectPath(chatId ? `/${chatId}` : undefined) ?? undefined;
		return (
			<ChatErrorLayout
				icon={<Lock className={styles.chatAccessErrorSearchX} aria-hidden />}
				title='Session expired'
				description='Sign in again to continue where you left off.'
			>
				<Button asChild>
					<Link to='/login' search={{ error: undefined, redirect }}>
						Sign in
					</Link>
				</Button>
			</ChatErrorLayout>
		);
	}

	if (isForbiddenError(error)) {
		return (
			<ChatErrorLayout
				icon={<Lock className={styles.chatAccessErrorSearchX} aria-hidden />}
				title="You don't have access to this chat"
				description='Ask the owner to share it with you if you need access.'
			>
				<Button asChild variant='secondary'>
					<Link to='/'>Go home</Link>
				</Button>
			</ChatErrorLayout>
		);
	}

	if (isInternalServerError(error)) {
		return (
			<ChatErrorLayout
				icon={<TriangleAlert className={styles.chatAccessErrorSearchX} aria-hidden />}
				title='Something went wrong'
				description="We couldn't load this chat. This is likely a temporary problem, so please try again."
			>
				{onRetry ? <Button onClick={onRetry}>Retry</Button> : null}
			</ChatErrorLayout>
		);
	}

	return (
		<ChatErrorLayout
			icon={<WifiOff className={styles.chatAccessErrorSearchX} aria-hidden />}
			title="Can't reach Loopwise"
			description='Check your connection and try again.'
		>
			{onRetry ? <Button onClick={onRetry}>Retry</Button> : null}
		</ChatErrorLayout>
	);
}

function ChatErrorLayout({
	icon,
	title,
	description,
	children,
}: {
	icon: React.ReactNode;
	title: string;
	description: string;
	children: React.ReactNode;
}) {
	return (
		<div className={styles.chatErrorLayoutDiv}>
			<MobileHeader />
			<div className={styles.chatErrorLayoutDiv2}>
				<div className={styles.chatErrorLayoutDiv3}>
					<div className={styles.chatErrorLayoutDiv4}>{icon}</div>
					<div className={styles.chatErrorLayoutDiv5}>
						<h1 className={styles.chatErrorLayoutH1}>{title}</h1>
						<p className={styles.chatErrorLayoutP}>{description}</p>
					</div>
					<div className={styles.chatErrorLayoutDiv6}>{children}</div>
				</div>
			</div>
		</div>
	);
}
