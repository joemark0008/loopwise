import { createFileRoute } from '@tanstack/react-router';
import { ClinicSettingsPage } from '@/feature/settings/clinic-page';

export const Route = createFileRoute('/_protected/settings/clinic/')({
	staticData: {
		title: 'Clinic Settings',
	},
	component: ClinicSettingsPage,
});
