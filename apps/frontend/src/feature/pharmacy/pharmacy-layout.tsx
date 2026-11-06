import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import styles from './pharmacy.module.css';
import { PageHeader } from '@/components/clinical/page-header';
import pageStyles from '@/components/clinical/page.module.css';
import { TabBar, tabPanelId, tabTriggerId } from '@/components/ui/tab-bar';
import { useCurrentClinic } from '@/hooks/use-current-clinic';

const TABS = [
	{ id: 'overview', label: 'Overview', to: '/pharmacy' },
	{ id: 'dispense', label: 'Dispense', to: '/pharmacy/dispense' },
	{ id: 'items', label: 'Items', to: '/pharmacy/items' },
	{ id: 'receive', label: 'Receive stock', to: '/pharmacy/receive' },
	{ id: 'suppliers', label: 'Suppliers', to: '/pharmacy/suppliers' },
	{ id: 'consumption', label: 'Supplies used', to: '/pharmacy/consumption' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/** What the signed-in user may do at the pharmacy of the selected clinic (the API checks the same roles). */
export function usePharmacyAccess() {
	const clinic = useCurrentClinic().data;
	const roles = clinic?.staffRoles ?? [];
	const isAdmin = clinic?.userRole === 'admin';
	return {
		/** Pharmacists and assistants dispense. */
		canDispense: isAdmin || roles.includes('PHARMACIST') || roles.includes('PHARMACY_ASSISTANT'),
		/** The inventory clerk receives, adjusts and keeps the item master and suppliers. */
		canManageStock: isAdmin || roles.includes('INVENTORY_CLERK'),
	};
}

/**
 * The clinic's pharmacy (DESIGN.md §5.5): the overview with the stock alerts, the dispense queue, the item master with
 * each item's lots and stock ledger, receiving deliveries, suppliers and supplies used on visits. Tabs are routes.
 */
export function PharmacyLayout() {
	const navigate = useNavigate();
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const { canDispense } = usePharmacyAccess();
	const tabs = TABS.filter((tab) => tab.id !== 'dispense' || canDispense);
	const active: TabId = TABS.find((tab) => tab.to !== '/pharmacy' && pathname.startsWith(tab.to))?.id ?? 'overview';

	return (
		<div className={pageStyles.page}>
			<PageHeader
				title='Pharmacy'
				subtitle='Dispensing, stock on hand by lot, deliveries and alerts at this clinic.'
			/>
			<TabBar
				idBase='pharmacy'
				className={styles.tabs}
				tabs={tabs.map((tab) => ({ id: tab.id, label: tab.label }))}
				activeTab={active}
				onTabChange={(id) => {
					const tab = TABS.find((candidate) => candidate.id === id);
					if (tab) {
						void navigate({ to: tab.to });
					}
				}}
			/>
			<div role='tabpanel' id={tabPanelId('pharmacy', active)} aria-labelledby={tabTriggerId('pharmacy', active)}>
				<Outlet />
			</div>
		</div>
	);
}
