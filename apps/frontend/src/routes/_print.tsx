import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

import { fetchSession } from '@/lib/session';
import { getSafeRedirectPath } from '@/lib/safe-redirect';

/** Printable documents (prescription, medical certificate, lab request): signed in, without the app shell. */
export const Route = createFileRoute('/_print')({
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
