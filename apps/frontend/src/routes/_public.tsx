import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

import { fetchSession } from '@/lib/session';
import { getSafeRedirectPath } from '@/lib/safe-redirect';
import { isSetupComplete } from '@/lib/setup-api';

export const Route = createFileRoute('/_public')({
	beforeLoad: async ({ location }) => {
		if (!(await isSetupComplete())) {
			throw redirect({ to: '/setup' });
		}
		if (await fetchSession()) {
			const target = getSafeRedirectPath((location.search as { redirect?: string }).redirect);
			throw redirect({ href: target ?? '/' });
		}
	},
	component: Outlet,
});
