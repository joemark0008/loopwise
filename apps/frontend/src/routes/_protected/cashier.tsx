import { createFileRoute } from '@tanstack/react-router';
import type { CashierTab } from '@/feature/billing/cashier-page';
import { CASHIER_TABS, CashierPage } from '@/feature/billing/cashier-page';

export const Route = createFileRoute('/_protected/cashier')({
	validateSearch: (search: Record<string, unknown>): { tab?: CashierTab } => ({
		tab: CASHIER_TABS.find((tab) => tab === search.tab),
	}),
	component: function CashierRoute() {
		const { tab } = Route.useSearch();
		return <CashierPage tab={tab ?? 'desk'} />;
	},
});
