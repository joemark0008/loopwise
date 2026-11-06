import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { formatPesos, INVOICE_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@loopwise/shared/invoice';
import { ListOrdered, ReceiptText } from 'lucide-react';
import styles from './billing.module.css';
import { InvoiceSeriesTab } from './invoice-series-tab';
import { ProfessionalFeesTab } from './professional-fees-tab';
import { ShiftPanel } from './shift-panel';
import { ShiftsTab } from './shifts-tab';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageHeader, PageSection } from '@/components/clinical/page-header';
import pageStyles from '@/components/clinical/page.module.css';
import { StatusBadge } from '@/components/clinical/status-badge';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { TabBar, tabPanelId, tabTriggerId } from '@/components/ui/tab-bar';
import { useCurrentClinic } from '@/hooks/use-current-clinic';
import { billingApi } from '@/lib/billing-api';

export const CASHIER_TABS = ['desk', 'shifts', 'fees', 'series'] as const;
export type CashierTab = (typeof CASHIER_TABS)[number];

const TAB_LABELS: Record<CashierTab, string> = {
	desk: 'Desk',
	shifts: 'Shifts',
	fees: 'Professional fees',
	series: 'Invoice series',
};

const idBase = 'cashier';

/** A clinic admin (SUPER_ADMIN / ADMIN): manages the series, voids and releases fees. */
export function useIsBillingAdmin(): boolean {
	const roles = useCurrentClinic().data?.staffRoles ?? [];
	return roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
}

/**
 * The cashier desk (PLAN.md §4.7): the cashier's shift (open, X reading, Z reading), the day's collections by method,
 * the invoices still to settle (each opens its visit's billing tab), the shift history, doctors' professional fees and
 * the clinic's BIR invoice series. The patients sent to the cashier are on the queue's cashier line.
 */
export function CashierPage({ tab }: { tab: CashierTab }) {
	const navigate = useNavigate();
	return (
		<div className={pageStyles.page}>
			<PageHeader
				title='Cashier'
				subtitle='Your shift, the day’s collections and the invoices to settle.'
				actions={
					<Button variant='outline' asChild>
						<Link to='/queue'>
							<ListOrdered />
							Cashier line
						</Link>
					</Button>
				}
			/>
			<TabBar
				idBase={idBase}
				tabs={CASHIER_TABS.map((id) => ({ id, label: TAB_LABELS[id] }))}
				activeTab={tab}
				onTabChange={(next) => void navigate({ to: '/cashier', search: { tab: next } })}
			/>
			<div role='tabpanel' id={tabPanelId(idBase, tab)} aria-labelledby={tabTriggerId(idBase, tab)}>
				{tab === 'desk' && <DeskTab />}
				{tab === 'shifts' && <ShiftsTab />}
				{tab === 'fees' && <ProfessionalFeesTab />}
				{tab === 'series' && <InvoiceSeriesTab />}
			</div>
		</div>
	);
}

function DeskTab() {
	const desk = useQuery(billingApi.billing.desk.queryOptions({}, { refetchInterval: 30_000 }));
	if (desk.isPending) {
		return <Skeleton />;
	}
	if (desk.error) {
		return <ErrorMessage message={desk.error.message} />;
	}
	const { myShift, collections, totalCollected, openInvoices } = desk.data;
	return (
		<div className={styles.desk}>
			<ShiftPanel shift={myShift ?? null} />
			<section className={styles.panel} aria-labelledby='collections-title' data-testid='collections'>
				<div className={styles.panelHeader}>
					<h2 id='collections-title' className={styles.panelTitle}>
						Today’s collections
					</h2>
					<span className={styles.figure}>{formatPesos(totalCollected)}</span>
				</div>
				{collections.length === 0 ? (
					<p className={styles.muted}>No payments yet today.</p>
				) : (
					<table className={styles.table}>
						<thead>
							<tr>
								<th scope='col'>Method</th>
								<th scope='col' data-numeric>
									Payments
								</th>
								<th scope='col' data-numeric>
									Amount
								</th>
							</tr>
						</thead>
						<tbody>
							{collections.map((total) => (
								<tr key={total.method}>
									<td>{PAYMENT_METHOD_LABELS[total.method]}</td>
									<td data-numeric>{total.count}</td>
									<td data-numeric>{formatPesos(total.amount)}</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</section>
			<PageSection title='Invoices to settle' meta={String(openInvoices.length)}>
				{openInvoices.length === 0 ? (
					<EmptyState icon={ReceiptText} title='Nothing to settle'>
						Drafts and issued invoices with a balance show here.
					</EmptyState>
				) : (
					<ul className={styles.list} data-testid='open-invoices'>
						{openInvoices.map((invoice) => (
							<li key={invoice.id} className={styles.listItem}>
								<span>
									<strong>{invoice.buyerName}</strong>
									<span className={styles.muted}>
										{' '}
										· {invoice.invoiceNo ?? 'draft'} · balance {formatPesos(invoice.balance)}
									</span>
								</span>
								<span className={styles.actions}>
									<StatusBadge
										status={invoice.status.toLowerCase()}
										title={INVOICE_STATUS_LABELS[invoice.status]}
									/>
									{invoice.patientId && invoice.encounterId && (
										<Button size='sm' variant='outline' asChild>
											<Link
												to='/patients/$patientId/encounters/$encounterId'
												params={{
													patientId: invoice.patientId,
													encounterId: invoice.encounterId,
												}}
												search={{ tab: 'billing' }}
											>
												Open billing
											</Link>
										</Button>
									)}
								</span>
							</li>
						))}
					</ul>
				)}
			</PageSection>
		</div>
	);
}
