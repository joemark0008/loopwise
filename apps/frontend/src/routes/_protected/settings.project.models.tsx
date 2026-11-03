import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/settings/project/models')({
	beforeLoad: () => {
		throw redirect({
			to: '/settings/project/agent',
			search: { tab: 'models' },
		});
	},
});
