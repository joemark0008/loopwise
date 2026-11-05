import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/settings/clinic/models')({
	beforeLoad: () => {
		throw redirect({
			to: '/settings/clinic/agent',
			search: { tab: 'models' },
		});
	},
});
