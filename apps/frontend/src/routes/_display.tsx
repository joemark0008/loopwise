import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

import { fetchSession } from '@/lib/session';
import { getSafeRedirectPath } from '@/lib/safe-redirect';

/** Full-screen displays (the waiting-room board): signed in, without the app shell. */
export const Route = createFileRoute('/_display')({
	beforeLoad: async ({ location }) => {
		if (!(await fetchSession())) {
			throw redirect({
				to: '/login',
				search: { error: undefined, redirect: getSafeRedirectPath(location.href) ?? undefined },
			});
		}
	},
	component: Outlet,
});
