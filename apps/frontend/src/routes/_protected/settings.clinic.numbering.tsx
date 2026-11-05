import { createFileRoute } from '@tanstack/react-router';
import { NumberingPage } from '@/feature/settings/clinic-setup/numbering-page';
import { requireAdmin } from '@/lib/route-guards';

export const Route = createFileRoute('/_protected/settings/clinic/numbering')({
	staticData: {
		title: 'Numbering',
		description: "Prefixes and digits of the clinic's document numbers.",
	},
	beforeLoad: requireAdmin,
	component: NumberingPage,
});
