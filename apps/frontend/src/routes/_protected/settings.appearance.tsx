import { createFileRoute } from '@tanstack/react-router';
import type { AppearanceTab } from '@/feature/settings/appearance-page';
import { requireNonViewer } from '@/lib/route-guards';
import { AppearancePage, isAppearanceTab } from '@/feature/settings/appearance-page';

export const Route = createFileRoute('/_protected/settings/appearance')({
	beforeLoad: requireNonViewer,
	staticData: {
		title: 'Appearance',
	},
	validateSearch: (search: Record<string, unknown>): { tab: AppearanceTab } => ({
		tab: isAppearanceTab(search.tab) ? search.tab : 'general',
	}),
	component: AppearancePage,
});
