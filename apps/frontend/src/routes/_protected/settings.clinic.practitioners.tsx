import { createFileRoute } from '@tanstack/react-router';
import { PractitionersPage } from '@/feature/settings/clinic-setup/practitioners-page';
import { requireAdmin } from '@/lib/route-guards';

export const Route = createFileRoute('/_protected/settings/clinic/practitioners')({
	staticData: {
		title: 'Practitioners',
		description: 'Credentials, room, fee, clinic hours and leaves.',
	},
	beforeLoad: requireAdmin,
	component: PractitionersPage,
});
