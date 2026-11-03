import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router';

import styles from './__root.module.css';
import { ModifyPassword } from '@/feature/auth/components/modify-password';
import { Spinner } from '@/components/ui/spinner';
import { useDisposeInactiveAgents } from '@/hooks/use-agent';
import { useSessionOrNavigateToIndexPage } from '@/hooks/use-session-or-navigate-to-index-page';
import { useNavigateToResetPasswordPageIfNeeded } from '@/hooks/useNavigateToResetPasswordPageIfNeeded';

export const Route = createRootRoute({
	component: RootComponent,
	errorComponent: ({ error }) => (
		<div className={styles.fullScreenCenter}>
			<div role='alert' className={styles.errorCard}>
				<strong>Something went wrong</strong>
				<p>{error instanceof Error ? error.message : String(error)}</p>
			</div>
		</div>
	),
});

function RootComponent() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	if (pathname.startsWith('/embed')) {
		return <Outlet />;
	}

	return <AuthenticatedRoot />;
}

function AuthenticatedRoot() {
	const session = useSessionOrNavigateToIndexPage();
	useDisposeInactiveAgents();

	if (useNavigateToResetPasswordPageIfNeeded()) {
		return <ModifyPassword />;
	}

	if (session.isPending) {
		return (
			<div className={styles.fullScreenCenter}>
				<Spinner className={styles.loadingSpinner} />
			</div>
		);
	}

	return (
		<div className={styles.rootShell}>
			<Outlet />
		</div>
	);
}
