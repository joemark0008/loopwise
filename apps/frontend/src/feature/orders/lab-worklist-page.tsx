import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { TestTubes } from 'lucide-react';
import { useState } from 'react';
import styles from './lab-worklist.module.css';
import { byPriorityThenAge, waitingFor } from './order-format';
import type { LabOrderFieldsFragment, OrderStatus } from '@/graphql/generated/graphql';
import { ClinicalFlag } from '@/components/clinical/clinical-flag';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageHeader, PageSection } from '@/components/clinical/page-header';
import pageStyles from '@/components/clinical/page.module.css';
import { StatusBadge } from '@/components/clinical/status-badge';
import { formatDateTime } from '@/feature/encounters/encounter-format';
import { VoidDialog } from '@/feature/encounters/void-dialog';
import { ageLabel, patientName } from '@/feature/patients/patient-format';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { TabBar, tabPanelId, tabTriggerId } from '@/components/ui/tab-bar';
import { ordersApi } from '@/lib/orders-api';

export const WORKLIST_TABS = ['sent', 'accepted', 'collected', 'resulted'] as const satisfies OrderStatus[];
export type WorklistTab = (typeof WORKLIST_TABS)[number];

const TAB_LABELS: Record<WorklistTab, string> = {
	sent: 'Incoming',
	accepted: 'Accepted',
	collected: 'Collected',
	resulted: 'Resulted',
};

const SECTION_TITLES: Record<WorklistTab, string> = {
	sent: 'New orders to accept',
	accepted: 'Accepted, to collect',
	collected: 'Collected, waiting for the result',
	resulted: 'Resulted',
};

const EMPTY: Record<WorklistTab, string> = {
	sent: 'New orders from the clinics arrive here. Facilities with a lab system get them over HL7 too.',
	accepted: 'Orders you accepted wait here until the specimen is taken.',
	collected: 'Specimens taken wait here until their result is sent back.',
	resulted: 'Orders whose results went back to the ordering doctor.',
};

/** When the order reached its current tab. */
const TAB_SINCE: Record<WorklistTab, (order: LabOrderFieldsFragment) => string | null> = {
	sent: (order) => order.sentAt,
	accepted: (order) => order.acceptedAt,
	collected: (order) => order.collectedAt,
	resulted: (order) => order.resultedAt,
};

const idBase = 'lab-worklist';

/**
 * The receiving facility's worklist (DESIGN.md §4.1 steps 2–4): orders sent to the lab, accepted, collected and
 * resulted. Staff accept or reject a new order and mark the specimen collected; results come back through the
 * results inbox. STAT first, then urgent, then the oldest.
 */
export function LabWorklistPage({ tab }: { tab: WorklistTab }) {
	const navigate = useNavigate();
	const counts = useQuery(ordersApi.order.labOrderCounts.queryOptions(undefined));
	const orders = useQuery(ordersApi.order.labOrders.queryOptions({ status: tab }));
	const countOf = (status: WorklistTab) => counts.data?.find((count) => count.status === status)?.count;
	const rows = byPriorityThenAge(orders.data ?? []);

	return (
		<div className={pageStyles.page}>
			<PageHeader title='Orders received' subtitle='Test orders sent to your lab or radiology unit.' />
			<TabBar
				idBase={idBase}
				className={styles.tabs}
				tabs={WORKLIST_TABS.map((id) => ({ id, label: TAB_LABELS[id], count: countOf(id) }))}
				activeTab={tab}
				onTabChange={(next) => void navigate({ to: '/orders', search: { tab: next } })}
			/>
			<div role='tabpanel' id={tabPanelId(idBase, tab)} aria-labelledby={tabTriggerId(idBase, tab)}>
				<PageSection title={SECTION_TITLES[tab]} meta={orders.data ? String(orders.data.length) : undefined}>
					{orders.isPending ? (
						<Skeleton />
					) : orders.error ? (
						<ErrorMessage message={orders.error.message} />
					) : rows.length === 0 ? (
						<EmptyState icon={TestTubes} title={`No ${TAB_LABELS[tab].toLowerCase()} orders`}>
							{EMPTY[tab]}
						</EmptyState>
					) : (
						<div className={pageStyles.tableScroll}>
							<table className={pageStyles.table} data-reflow data-testid='lab-worklist'>
								<caption className='sr-only'>{SECTION_TITLES[tab]}</caption>
								<thead>
									<tr>
										<th scope='col'>Patient</th>
										<th scope='col'>Test</th>
										<th scope='col'>Priority</th>
										<th scope='col'>Ordered by</th>
										<th scope='col'>Received</th>
										<th scope='col'>Status</th>
										<th scope='col'>
											<span className='sr-only'>Actions</span>
										</th>
									</tr>
								</thead>
								<tbody>
									{rows.map((order) => (
										<WorklistRow key={order.id} order={order} tab={tab} />
									))}
								</tbody>
							</table>
						</div>
					)}
				</PageSection>
			</div>
		</div>
	);
}

function WorklistRow({ order, tab }: { order: LabOrderFieldsFragment; tab: WorklistTab }) {
	const since = TAB_SINCE[tab](order) ?? order.sentAt ?? order.createdAt;
	const name = patientName(order.patient);
	return (
		<tr data-testid='lab-order-row' data-order-id={order.id}>
			<td data-label='Patient'>
				<div className={styles.stack}>
					<div className={styles.main}>{name}</div>
					<div className={styles.muted}>
						{ageLabel(
							order.patient.birthDate,
							order.patient.sex as 'female' | 'male' | 'other' | 'unknown',
						)}
					</div>
				</div>
			</td>
			<td data-label='Test'>
				<div className={styles.stack}>
					<div>{order.display ?? order.code}</div>
					<div className={styles.muted}>LOINC {order.code}</div>
					{order.notes && <div className={styles.muted}>{order.notes}</div>}
				</div>
			</td>
			<td data-label='Priority'>
				{order.priority === 'routine' ? (
					<span className={styles.muted}>Routine</span>
				) : (
					<ClinicalFlag tone={order.priority === 'stat' ? 'critical' : 'abnormal'}>
						{order.priority === 'stat' ? 'STAT' : 'Urgent'}
					</ClinicalFlag>
				)}
			</td>
			<td data-label='Ordered by'>
				<div className={styles.stack}>
					<div>{order.orderingDoctorName}</div>
					<div className={styles.muted}>{order.orderingFacilityName}</div>
				</div>
			</td>
			<td data-label='Received' className={styles.nowrap}>
				<div className={styles.stack}>
					<div>{order.sentAt ? formatDateTime(order.sentAt) : '—'}</div>
					<div className={styles.muted}>{waitingFor(since)} ago</div>
				</div>
			</td>
			<td data-label='Status'>
				<StatusBadge status={order.status} />
			</td>
			<td data-label='Actions' className={styles.actionsCell}>
				<RowActions order={order} name={name} />
			</td>
		</tr>
	);
}

function RowActions({ order, name }: { order: LabOrderFieldsFragment; name: string }) {
	const queryClient = useQueryClient();
	const [rejecting, setRejecting] = useState(false);
	const refresh = { onSuccess: () => queryClient.invalidateQueries(ordersApi.order.labOrders.pathFilter()) };
	const accept = useMutation(ordersApi.order.accept.mutationOptions(refresh));
	const collect = useMutation(ordersApi.order.markCollected.mutationOptions(refresh));
	const reject = useMutation(
		ordersApi.order.reject.mutationOptions({
			onSuccess: async () => {
				setRejecting(false);
				await refresh.onSuccess();
			},
		}),
	);
	const test = order.display ?? order.code;
	const error = accept.error ?? collect.error;

	if (order.status === 'sent') {
		return (
			<div className={styles.actions}>
				<Button
					size='sm'
					variant='outline'
					onClick={() => setRejecting(true)}
					aria-label={`Reject ${test} for ${name}`}
				>
					Reject
				</Button>
				<Button
					size='sm'
					onClick={() => accept.mutate({ orderId: order.id })}
					disabled={accept.isPending}
					aria-label={`Accept ${test} for ${name}`}
				>
					Accept
				</Button>
				{error && <ErrorMessage message={error.message} />}
				<VoidDialog
					open={rejecting}
					onOpenChange={setRejecting}
					title={`Reject ${test}?`}
					description={`The ordering doctor sees the reason. ${name}'s order closes and the doctor can order elsewhere.`}
					actionLabel='Reject order'
					placeholder='Test not offered'
					onVoid={(reason) => reject.mutate({ orderId: order.id, reason })}
					isPending={reject.isPending}
					error={reject.error?.message}
				/>
			</div>
		);
	}
	if (order.status === 'accepted') {
		return (
			<div className={styles.actions}>
				<Button
					size='sm'
					onClick={() => collect.mutate({ orderId: order.id })}
					disabled={collect.isPending}
					aria-label={`Mark ${test} for ${name} collected`}
				>
					Mark collected
				</Button>
				{error && <ErrorMessage message={error.message} />}
			</div>
		);
	}
	return null;
}
