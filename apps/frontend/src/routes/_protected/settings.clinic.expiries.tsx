import { createFileRoute } from '@tanstack/react-router';
import { ExpiriesPage } from '@/feature/settings/clinic-setup/expiries-page';
import { requireAdmin } from '@/lib/route-guards';

export const Route = createFileRoute('/_protected/settings/clinic/expiries')({
	staticData: {
		title: 'Expiring licenses',
		description: 'PRC, S2, PhilHealth and DOH licenses to renew soon.',
	},
	beforeLoad: requireAdmin,
	component: ExpiriesPage,
});
