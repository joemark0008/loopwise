import { createFileRoute } from '@tanstack/react-router';
import type { WorklistTab } from '@/feature/orders/lab-worklist-page';
import { LabWorklistPage, WORKLIST_TABS } from '@/feature/orders/lab-worklist-page';

export const Route = createFileRoute('/_protected/orders')({
	validateSearch: (search: Record<string, unknown>): { tab?: WorklistTab } => ({
		tab: WORKLIST_TABS.find((tab) => tab === search.tab),
	}),
	component: function OrdersRoute() {
		const { tab } = Route.useSearch();
		return <LabWorklistPage tab={tab ?? 'collect'} />;
	},
});
