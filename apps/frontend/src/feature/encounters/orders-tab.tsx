import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Printer } from 'lucide-react';
import { useState } from 'react';
import styles from './encounter.module.css';
import ownStyles from './orders-tab.module.css';
import { formatDateTime } from './encounter-format';
import { FormField } from './form-field';
import { VoidDialog } from './void-dialog';
import type { DiagnosticOrderFieldsFragment, OrderPriority } from '@/graphql/generated/graphql';
import { ClinicalFlag, FlaggedValue, ResultFlagChip } from '@/components/clinical/clinical-flag';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Empty } from '@/components/ui/empty';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DiagnosticStatusBadge } from '@/feature/orders/diagnostic-status-badge';
import { CANCELLABLE, PRIORITY_LABELS } from '@/feature/orders/order-format';
import { valueText } from '@/feature/results/result-format';
import { ordersApi } from '@/lib/orders-api';

const PRIORITIES: OrderPriority[] = ['ROUTINE', 'URGENT', 'STAT'];

type OrderItem = DiagnosticOrderFieldsFragment['items'][number];

/**
 * The tests requested from the visit and their results. Requesting creates one order (numbered per clinic) for the
 * clinic's own lab, which collects, runs and releases each test from its worklist; released results reach the doctor's
 * results inbox. A test can be cancelled until its result is in.
 */
export function OrdersTab({ record }: { record: { encounter: { id: string }; canEdit: boolean } }) {
	const encounterId = record.encounter.id;
	const orders = useQuery(ordersApi.order.forEncounter.queryOptions({ encounterId }));
	const [cancelling, setCancelling] = useState<{ order: DiagnosticOrderFieldsFragment; item: OrderItem } | null>(
		null,
	);
	const items = (orders.data ?? []).flatMap((order) => order.items.map((item) => ({ order, item })));

	return (
		<>
			<section className={styles.section}>
				<div className={styles.sectionHeader}>
					<h3 className={styles.sectionTitle}>Orders and results</h3>
					{items.length > 0 && (
						<Button asChild size='sm' variant='outline'>
							<Link to='/print/lab-request/$encounterId' params={{ encounterId }} target='_blank'>
								<Printer />
								Lab request
							</Link>
						</Button>
					)}
				</div>
				{orders.error && <ErrorMessage message={orders.error.message} />}
				{orders.isPending ? null : items.length === 0 ? (
					<Empty>No tests requested from this visit.</Empty>
				) : (
					<div className={styles.tableScroll} role='region' aria-label='Orders and results' tabIndex={0}>
						<table className={styles.table} data-testid='order-list'>
							<thead>
								<tr>
									<th scope='col'>Test</th>
									<th scope='col' data-numeric>
										Result
									</th>
									<th scope='col'>Reference</th>
									<th scope='col'>Flag</th>
									<th scope='col'>Status</th>
									{record.canEdit && (
										<th scope='col'>
											<span className='sr-only'>Actions</span>
										</th>
									)}
								</tr>
							</thead>
							<tbody>
								{items.flatMap(({ order, item }) => {
									const name = (
										<>
											<span className={styles.listMain}>{item.test.name}</span>
											<div className={styles.muted}>
												{order.orderNo}
												{order.clinicalInfo && ` · ${order.clinicalInfo}`}
											</div>
											{order.priority !== 'ROUTINE' && (
												<ClinicalFlag
													tone={order.priority === 'STAT' ? 'critical' : 'abnormal'}
												>
													{PRIORITY_LABELS[order.priority]}
												</ClinicalFlag>
											)}
										</>
									);
									const status = (
										<td>
											<DiagnosticStatusBadge status={item.status} />
											{item.statusReason && (
												<div className={styles.muted}>{item.statusReason}</div>
											)}
											{item.result?.releasedAt && (
												<div className={styles.muted}>
													{formatDateTime(item.result.releasedAt)}
												</div>
											)}
										</td>
									);
									const actions = record.canEdit && (
										<td>
											{CANCELLABLE.includes(item.status) && (
												<Button
													size='sm'
													variant='outline'
													onClick={() => setCancelling({ order, item })}
													aria-label={`Cancel ${item.test.name}`}
												>
													Cancel
												</Button>
											)}
										</td>
									);
									const released = item.status === 'RELEASED' ? item.result : null;
									if (!released || (released.values.length === 0 && !released.impression)) {
										return [
											<tr key={item.id} data-voided={item.status === 'CANCELLED' || undefined}>
												<td>{name}</td>
												<td data-numeric className={styles.muted}>
													{released
														? 'See report'
														: item.status === 'CANCELLED'
															? '—'
															: 'Pending'}
												</td>
												<td />
												<td />
												{status}
												{actions}
											</tr>,
										];
									}
									if (released.values.length === 0) {
										return [
											<tr key={item.id}>
												<td>{name}</td>
												<td>{released.impression}</td>
												<td />
												<td />
												{status}
												{actions}
											</tr>,
										];
									}
									return released.values.map((value, index) => (
										<tr key={value.id} data-flag={value.flag ?? undefined}>
											<td>
												{index === 0 ? name : null}
												{released.values.length > 1 && (
													<div className={styles.muted}>{value.name}</div>
												)}
											</td>
											<td data-numeric>
												<FlaggedValue flag={value.flag}>{valueText(value)}</FlaggedValue>
											</td>
											<td className={styles.muted}>{value.referenceRange ?? '—'}</td>
											<td>{value.flag && <ResultFlagChip flag={value.flag} />}</td>
											{index === 0 ? status : <td />}
											{index === 0 ? actions : record.canEdit && <td />}
										</tr>
									));
								})}
							</tbody>
						</table>
					</div>
				)}
			</section>
			{record.canEdit && <NewOrderForm encounterId={encounterId} />}
			<CancelTestDialog target={cancelling} onClose={() => setCancelling(null)} />
		</>
	);
}

function CancelTestDialog({
	target,
	onClose,
}: {
	target: { order: DiagnosticOrderFieldsFragment; item: OrderItem } | null;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const cancel = useMutation(
		ordersApi.order.cancel.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries(ordersApi.order.forEncounter.pathFilter());
				onClose();
			},
		}),
	);
	return (
		<VoidDialog
			open={target !== null}
			onOpenChange={(open) => !open && onClose()}
			title={`Cancel ${target?.item.test.name ?? 'the test'}?`}
			description="The lab sees your reason; it stays on the visit's orders, cancelled."
			actionLabel='Cancel test'
			placeholder='No longer needed'
			onVoid={(reason) => target && cancel.mutate({ orderId: target.order.id, itemId: target.item.id, reason })}
			isPending={cancel.isPending}
			error={cancel.error?.message}
		/>
	);
}

function NewOrderForm({ encounterId }: { encounterId: string }) {
	const queryClient = useQueryClient();
	const tests = useQuery(ordersApi.order.tests.queryOptions(undefined));
	const [testIds, setTestIds] = useState<string[]>([]);
	const [priority, setPriority] = useState<OrderPriority>('ROUTINE');
	const [clinicalInfo, setClinicalInfo] = useState('');
	const create = useMutation(
		ordersApi.order.create.mutationOptions({
			onSuccess: async () => {
				setTestIds([]);
				setClinicalInfo('');
				await queryClient.invalidateQueries(ordersApi.order.forEncounter.pathFilter());
			},
		}),
	);
	const toggle = (id: string, on: boolean) =>
		setTestIds(on ? [...testIds, id] : testIds.filter((candidate) => candidate !== id));

	return (
		<form
			className={styles.section}
			onSubmit={(event) => {
				event.preventDefault();
				create.mutate({ encounterId, testIds, priority, clinicalInfo: clinicalInfo.trim() || null });
			}}
		>
			<h3 className={styles.sectionTitle}>Request tests</h3>
			<fieldset className={ownStyles.tests} aria-label='Tests'>
				{(tests.data ?? []).map((test) => (
					<label key={test.id} className={ownStyles.test}>
						<Checkbox
							checked={testIds.includes(test.id)}
							onCheckedChange={(on) => toggle(test.id, on)}
							disabled={create.isPending}
						/>
						{test.name}
						{test.requiresFasting && <span className={ownStyles.fasting}>(fasting)</span>}
					</label>
				))}
			</fieldset>
			<div className={styles.fields}>
				<FormField label='Priority'>
					{() => (
						<Select value={priority} onValueChange={(value) => setPriority(value as OrderPriority)}>
							<SelectTrigger className={styles.control} aria-label='Priority'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{PRIORITIES.map((option) => (
									<SelectItem key={option} value={option}>
										{PRIORITY_LABELS[option]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</FormField>
				<FormField label='Clinical information' wide>
					{(id) => (
						<Input
							id={id}
							className={styles.control}
							value={clinicalInfo}
							maxLength={500}
							placeholder='Printed on the request, e.g. T2DM on metformin'
							onChange={(event) => setClinicalInfo(event.target.value)}
						/>
					)}
				</FormField>
			</div>
			{tests.error && <ErrorMessage message={tests.error.message} />}
			{create.error && <ErrorMessage message={create.error.message} />}
			<div className={styles.actions}>
				<Button type='submit' size='sm' disabled={testIds.length === 0 || create.isPending}>
					{testIds.length > 1 ? `Request ${testIds.length} tests` : 'Request test'}
				</Button>
			</div>
		</form>
	);
}
