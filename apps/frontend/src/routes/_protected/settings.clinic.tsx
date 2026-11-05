import { createFileRoute, redirect } from '@tanstack/react-router';
import { fetchCurrentClinic } from '@/hooks/use-current-clinic';
import { ClinicPage } from '@/feature/settings/clinic-layout';

export const Route = createFileRoute('/_protected/settings/clinic')({
	beforeLoad: async () => {
		const clinic = await fetchCurrentClinic();
		if (clinic?.userRole === 'viewer') {
			throw redirect({ to: '/settings/account' });
		}
	},
	component: ClinicPage,
});
