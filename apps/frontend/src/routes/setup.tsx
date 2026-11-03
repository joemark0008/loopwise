import { createFileRoute, redirect } from '@tanstack/react-router';

import { Setup } from '@/feature/auth/setup-page';
import { isSetupComplete } from '@/lib/setup-api';

export const Route = createFileRoute('/setup')({
	beforeLoad: async () => {
		if (await isSetupComplete()) {
			throw redirect({ to: '/login', search: { error: undefined, redirect: undefined } });
		}
	},
	component: Setup,
});
