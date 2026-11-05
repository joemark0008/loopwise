import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { TestTubes } from 'lucide-react';
import { useState } from 'react';
import { DiagnosticStatusBadge } from './diagnostic-status-badge';
import { EnterResultDialog } from './enter-result-dialog';
import styles from './lab-worklist.module.css';
import { ageSex, byPriorityThenAge, PRIORITY_LABELS, personName, waitingFor } from './order-format';
import type { DiagnosticOrderStatus, LabWorklistItemFieldsFragment } from '@/graphql/generated/graphql';
import { ClinicalFlag, ResultFlagChip } from '@/components/clinical/clinical-flag';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageHeader, PageSection } from '@/components/clinical/page-header';
import pageStyles from '@/components/clinical/page.module.css';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { TabBar, tabPanelId, tabTriggerId } from '@/components/ui/tab-bar';
import { formatDateTime } from '@/feature/encounters/encounter-format';
import { VoidDialog } from '@/feature/encounters/void-dialog';
import { ordersApi } from '@/lib/orders-api';

/** The worklist tabs, one per step before release. */
export const WORKLIST_TABS = ['collect', 'collected', 'running', 'release'] as const;
export type WorklistTab = (typeof WORKLIST_TABS)[number];

const TAB_STATUSES: Record<WorklistTab, DiagnosticOrderStatus[]> = {
	collect: ['REQUESTED', 'PAID'],
	collected: ['SPECIMEN_COLLECTED'],
	running: ['IN_PROGRESS'],
	release: ['RESULTED'],
};

const TAB_LABELS: Record<WorklistTab, string> = {
	collect: 'To collect',
	collected: 'Collected',
	running: 'In progress',
	release: 'To release',
};

const SECTION_TITLES: Record<WorklistTab, string> = {
	collect: 'Requested, to collect',
	collected: 'Specimen collected, to run',
	running: 'Running, to enter the result',
	release: 'Resulted, to check and release',
};

const EMPTY: Record<WorklistTab, string> = {
	collect: "Tests the clinic's doctors request arrive here.",
	collected: 'Specimens you collected wait here until you run them.',
	running: 'Tests on the analyser or in the X-ray room wait here for their result.',
	release: "Entered results wait here until you check them and release them to the doctor's inbox.",
};

const idBase = 'lab-worklist';

/**
 * The clinic's lab desk (in-house laboratory and imaging): requested tests to collect, collected specimens to run,
 * runs to result, and results to release to the requesting doctor. STAT first, then urgent, then the oldest. Values
 * are flagged from the test's reference range for the patient's sex; critical values reach the doctor, never an
 * automated message to the patient.
 */
export function LabWorklistPage({ tab }: { tab: WorklistTab }) {
	const navigate = useNavigate();
	const [entering, setEntering] = useState<LabWorklistItemFieldsFragment | null>(null);
	const counts = useQuery(ordersApi.order.worklistCounts.queryOptions(undefined));
	const items = useQuery(ordersApi.order.worklist.queryOptions({ statuses: TAB_STATUSES[tab] }));
	const countOf = (id: WorklistTab) =>
		counts.data
			?.filter((count) => TAB_STATUSES[id].includes(count.status))
			.reduce((sum, count) => sum + count.count, 0);
	const rows = byPriorityThenAge(items.data ?? []);

	return (
		<div className={pageStyles.page}>
			<PageHeader title='Lab worklist' subtitle="The clinic's laboratory and imaging requests, by step." />
			<TabBar
				idBase={idBase}
				className={styles.tabs}
				tabs={WORKLIST_TABS.map((id) => ({ id, label: TAB_LABELS[id], count: countOf(id) }))}
				activeTab={tab}
				onTabChange={(next) => void navigate({ to: '/orders', search: { tab: next } })}
			/>
			<div role='tabpanel' id={tabPanelId(idBase, tab)} aria-labelledby={tabTriggerId(idBase, tab)}>
				<PageSection title={SECTION_TITLES[tab]} meta={items.data ? String(items.data.length) : undefined}>
					{items.isPending ? (
						<Skeleton />
					) : items.error ? (
						<ErrorMessage message={items.error.message} />
					) : rows.length === 0 ? (
						<EmptyState icon={TestTubes} title={`Nothing ${TAB_LABELS[tab].toLowerCase()}`}>
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
										<th scope='col'>Requested by</th>
										<th scope='col'>Ordered</th>
										<th scope='col'>Status</th>
										<th scope='col'>
											<span className='sr-only'>Actions</span>
										</th>
									</tr>
								</thead>
								<tbody>
									{rows.map((item) => (
										<WorklistRow key={item.id} item={item} onEnterResult={setEntering} />
									))}
								</tbody>
							</table>
						</div>
					)}
				</PageSection>
			</div>
			<EnterResultDialog item={entering} onOpenChange={(open) => !open && setEntering(null)} />
		</div>
	);
}

function WorklistRow({
	item,
	onEnterResult,
}: {
	item: LabWorklistItemFieldsFragment;
	onEnterResult: (item: LabWorklistItemFieldsFragment) => void;
}) {
	const name = personName(item.patient);
	return (
		<tr data-testid='lab-order-row' data-item-id={item.id}>
			<td data-label='Patient'>
				<div className={styles.stack}>
					<div className={styles.main}>{name}</div>
					<div className={styles.muted}>
						{ageSex(item.patient.birthDate, item.patient.sex as 'MALE' | 'FEMALE')} ·{' '}
						{item.patient.patientNo}
					</div>
				</div>
			</td>
			<td data-label='Test'>
				<div className={styles.stack}>
					<div>{item.test.name}</div>
					<div className={styles.muted}>
						{item.order.orderNo}
						{item.accessionNo && ` · ${item.accessionNo}`}
					</div>
					{item.order.clinicalInfo && <div className={styles.muted}>{item.order.clinicalInfo}</div>}
				</div>
			</td>
			<td data-label='Priority'>
				{item.order.priority === 'ROUTINE' ? (
					<span className={styles.muted}>Routine</span>
				) : (
					<ClinicalFlag tone={item.order.priority === 'STAT' ? 'critical' : 'abnormal'}>
						{PRIORITY_LABELS[item.order.priority]}
					</ClinicalFlag>
				)}
			</td>
			<td data-label='Requested by'>
				{item.order.requestedByName ?? item.order.externalPhysician ?? <span className={styles.muted}>—</span>}
			</td>
			<td data-label='Ordered' className={styles.nowrap}>
				<div className={styles.stack}>
					<div>{formatDateTime(item.order.createdAt)}</div>
					<div className={styles.muted}>{waitingFor(item.order.createdAt)} ago</div>
				</div>
			</td>
			<td data-label='Status'>
				<DiagnosticStatusBadge status={item.status} />
				{item.result?.flag && (
					<>
						{' '}
						<ResultFlagChip flag={item.result.flag} />
					</>
				)}
			</td>
			<td data-label='Actions' className={styles.actionsCell}>
				<RowActions item={item} name={name} onEnterResult={onEnterResult} />
			</td>
		</tr>
	);
}

function RowActions({
	item,
	name,
	onEnterResult,
}: {
	item: LabWorklistItemFieldsFragment;
	name: string;
	onEnterResult: (item: LabWorklistItemFieldsFragment) => void;
}) {
	const queryClient = useQueryClient();
	const [cancelling, setCancelling] = useState(false);
	const refresh = { onSuccess: () => queryClient.invalidateQueries(ordersApi.order.worklist.pathFilter()) };
	const collect = useMutation(ordersApi.order.collect.mutationOptions(refresh));
	const start = useMutation(ordersApi.order.start.mutationOptions(refresh));
	const release = useMutation(ordersApi.order.release.mutationOptions(refresh));
	const cancel = useMutation(
		ordersApi.order.cancel.mutationOptions({
			onSuccess: async () => {
				setCancelling(false);
				await refresh.onSuccess();
			},
		}),
	);
	const test = item.test.name;
	const error = collect.error ?? start.error ?? release.error;
	const isImaging = item.test.parameters.length === 0;
	const canCancel = item.status !== 'RESULTED';

	return (
		<div className={styles.actions}>
			{canCancel && (
				<Button
					size='sm'
					variant='outline'
					onClick={() => setCancelling(true)}
					aria-label={`Cancel ${test} for ${name}`}
				>
					Cancel
				</Button>
			)}
			{(item.status === 'REQUESTED' || item.status === 'PAID') &&
				(isImaging ? (
					<Button
						size='sm'
						onClick={() => start.mutate({ itemId: item.id })}
						disabled={start.isPending}
						aria-label={`Start ${test} for ${name}`}
					>
						Start
					</Button>
				) : (
					<Button
						size='sm'
						onClick={() => collect.mutate({ itemId: item.id })}
						disabled={collect.isPending}
						aria-label={`Mark ${test} for ${name} collected`}
					>
						Mark collected
					</Button>
				))}
			{item.status === 'SPECIMEN_COLLECTED' && (
				<Button
					size='sm'
					onClick={() => start.mutate({ itemId: item.id })}
					disabled={start.isPending}
					aria-label={`Start ${test} for ${name}`}
				>
					Start
				</Button>
			)}
			{(item.status === 'IN_PROGRESS' || item.status === 'RESULTED') && (
				<Button
					size='sm'
					variant={item.status === 'RESULTED' ? 'outline' : 'default'}
					onClick={() => onEnterResult(item)}
					aria-label={`${item.status === 'RESULTED' ? 'Edit' : 'Enter'} the result of ${test} for ${name}`}
				>
					{item.status === 'RESULTED' ? 'Edit result' : 'Enter result'}
				</Button>
			)}
			{item.status === 'RESULTED' && (
				<Button
					size='sm'
					onClick={() => release.mutate({ itemId: item.id })}
					disabled={release.isPending}
					aria-label={`Release ${test} for ${name}`}
				>
					Release
				</Button>
			)}
			{error && <ErrorMessage message={error.message} />}
			<VoidDialog
				open={cancelling}
				onOpenChange={setCancelling}
				title={`Cancel ${test}?`}
				description={`The requesting doctor sees the reason. ${name}'s test closes; the doctor can request it again.`}
				actionLabel='Cancel test'
				placeholder='Specimen haemolysed'
				onVoid={(reason) => cancel.mutate({ orderId: item.order.id, itemId: item.id, reason })}
				isPending={cancel.isPending}
				error={cancel.error?.message}
			/>
		</div>
	);
}
