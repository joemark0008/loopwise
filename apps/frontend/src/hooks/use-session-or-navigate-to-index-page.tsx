import { useEffect } from 'react';
import { useNavigate, useRouter, useRouterState } from '@tanstack/react-router';

import { useSession } from '@/lib/auth-client';
import { invalidateSession } from '@/lib/session';
import { getSafeRedirectPath } from '@/lib/safe-redirect';
import { usePublicConfig } from '@/hooks/use-public-config';

const AUTH_ENTRY_ROUTES = ['/login', '/forgot-password', '/reset-password'];
const PUBLIC_AUTH_ROUTES = [...AUTH_ENTRY_ROUTES, '/email-verified', '/setup', '/set-password'];

export const useSessionOrNavigateToIndexPage = () => {
	const navigate = useNavigate();
	const router = useRouter();
	const session = useSession();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const searchStr = useRouterState({ select: (s) => s.location.searchStr });
	const config = usePublicConfig();

	useEffect(() => {
		if (session.isPending || config.isPending) {
			return;
		}

		const canStayUnauthenticated = PUBLIC_AUTH_ROUTES.includes(pathname);

		if (!session.data) {
			invalidateSession();
		}

		if (!session.data && !canStayUnauthenticated) {
			const redirect = getSafeRedirectPath(`${pathname}${searchStr ?? ''}`) ?? undefined;
			navigate({ to: '/login', search: { error: undefined, redirect } });
		}

		// The _public guard handles login and forgot-password, without racing a sign-out in progress.
		if (session.data && pathname === '/reset-password') {
			const redirect = getSafeRedirectPath(new URLSearchParams(searchStr ?? '').get('redirect'));
			if (redirect) {
				router.history.push(redirect);
			} else {
				navigate({ to: '/' });
			}
		}
	}, [session.isPending, session.data, config.isPending, navigate, router, pathname, searchStr]);

	return {
		...session,
		isPending: session.isPending || config.isPending,
	};
};
