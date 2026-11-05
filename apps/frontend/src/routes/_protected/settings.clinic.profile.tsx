import { createFileRoute } from '@tanstack/react-router';
import { ClinicProfilePage } from '@/feature/settings/clinic-setup/clinic-profile-page';
import { requireAdmin } from '@/lib/route-guards';

export const Route = createFileRoute('/_protected/settings/clinic/profile')({
	staticData: {
		title: 'Clinic profile',
		description: 'Legal details, registrations and address of the organization and this clinic.',
	},
	beforeLoad: requireAdmin,
	component: ClinicProfilePage,
});
