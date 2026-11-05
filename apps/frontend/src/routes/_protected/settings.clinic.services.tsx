import { createFileRoute } from '@tanstack/react-router';
import { ServicesPage } from '@/feature/settings/clinic-setup/services-page';
import { requireAdmin } from '@/lib/route-guards';

export const Route = createFileRoute('/_protected/settings/clinic/services')({
	staticData: {
		title: 'Services and prices',
		description: "The price list and this clinic's own prices.",
	},
	beforeLoad: requireAdmin,
	component: ServicesPage,
});
