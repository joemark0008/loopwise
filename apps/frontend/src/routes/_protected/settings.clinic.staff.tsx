import { createFileRoute } from '@tanstack/react-router';
import { StaffPage } from '@/feature/settings/clinic-setup/staff-page';
import { requireOrgAdmin } from '@/lib/route-guards';

export const Route = createFileRoute('/_protected/settings/clinic/staff')({
	staticData: {
		title: 'Staff and roles',
		description: 'Who works at this clinic, at which desks.',
	},
	beforeLoad: requireOrgAdmin,
	component: StaffPage,
});
