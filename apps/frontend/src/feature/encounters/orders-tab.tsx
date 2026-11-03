import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Printer } from 'lucide-react';
import { useState } from 'react';
import styles from './encounter.module.css';
import { formatDateTime } from './encounter-format';
import { FormField } from './form-field';
import { useRecordMutation } from './use-record-mutation';
import type { EncounterRecordFieldsFragment, OrderPriority } from '@/graphql/generated/graphql';
import { ClinicalFlag, FlaggedValue, ResultFlagChip } from '@/components/clinical/clinical-flag';
import { StatusBadge } from '@/components/clinical/status-badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { encounterRecordApi } from '@/lib/encounter-record-api';

const PRIORITIES: OrderPriority[] = ['routine', 'urgent', 'stat'];
const PRIORITY_LABELS: Record<OrderPriority, string> = { routine: 'Routine', urgent: 'Urgent', stat: 'STAT' };

/**
 * Tests ordered from the visit and their results. Ordering sends the order to the lab or imaging facility, which
 * accepts it and marks the specimen collected (its worklist, or HL7); the results arrive through the results feature.
 */
export function OrdersTab({ record }: { record: EncounterRecordFieldsFragment }) {
	return (
		<>
			<section className={styles.section}>
				<div className={styles.sectionHeader}>
					<h3 className={styles.sectionTitle}>Orders and results</h3>
					{record.orders.length > 0 && (
						<Button asChild size='sm' variant='outline'>
							<Link
								to='/print/lab-request/$encounterId'
								params={{ encounterId: record.encounter.id }}
								target='_blank'
							>
								<Printer />
								Lab request
							</Link>
						</Button>
					)}
				</div>
				{record.orders.length === 0 ? (
					<Empty>No tests ordered from this visit.</Empty>
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
									<th scope='col'>Sent to</th>
									<th scope='col'>Status</th>
								</tr>
							</thead>
							<tbody>
								{record.orders.flatMap((order) => {
									const name = (
										<>
											<span className={styles.listMain}>{order.display ?? order.code}</span>
											{order.notes && <div className={styles.muted}>{order.notes}</div>}
											{order.priority !== 'routine' && (
												<>
													{' '}
													<ClinicalFlag
														tone={order.priority === 'stat' ? 'critical' : 'abnormal'}
													>
														{order.priority === 'stat' ? 'STAT' : 'Urgent'}
													</ClinicalFlag>
												</>
											)}
										</>
									);
									const sent = (
										<td>
											{order.targetFacility?.name ?? 'Facility'}
											<div className={styles.muted}>
												{order.sentAt ? formatDateTime(order.sentAt) : 'not sent'}
											</div>
										</td>
									);
									if (order.results.length === 0) {
										return [
											<tr key={order.id}>
												<td>{name}</td>
												<td data-numeric className={styles.muted}>
													{order.status === 'resulted' || order.status === 'reviewed'
														? 'No values'
														: 'Pending'}
												</td>
												<td />
												<td />
												{sent}
												<td>
													<OrderStatusCell order={order} />
												</td>
											</tr>,
										];
									}
									return order.results.map((result, index) => (
										<tr key={result.id} data-flag={result.flag ?? undefined}>
											<td>
												{index === 0 ? name : null}
												{(order.results.length > 1 || result.display !== order.display) && (
													<div className={styles.muted}>{result.display ?? 'Result'}</div>
												)}
											</td>
											<td data-numeric>
												<FlaggedValue flag={result.flag}>
													{result.value}
													{result.unit && <span className={styles.unit}> {result.unit}</span>}
												</FlaggedValue>
											</td>
											<td className={styles.muted}>{result.refRange ?? '—'}</td>
											<td>{result.flag && <ResultFlagChip flag={result.flag} />}</td>
											{index === 0 ? sent : <td />}
											<td>{index === 0 && <OrderStatusCell order={order} />}</td>
										</tr>
									));
								})}
							</tbody>
						</table>
					</div>
				)}
			</section>
			{record.canEdit && <NewOrderForm encounterId={record.encounter.id} />}
		</>
	);
}

/** The order's status, when it got there, and why when the lab rejected it or the doctor cancelled it. */
function OrderStatusCell({ order }: { order: EncounterRecordFieldsFragment['orders'][number] }) {
	const at =
		order.status === 'accepted'
			? order.acceptedAt
			: order.status === 'collected'
				? order.collectedAt
				: order.status === 'rejected' || order.status === 'cancelled'
					? order.closedAt
					: null;
	return (
		<>
			<StatusBadge status={order.status} />
			{at && <div className={styles.muted}>{formatDateTime(at)}</div>}
			{order.statusReason && <div className={styles.muted}>{order.statusReason}</div>}
		</>
	);
}

function NewOrderForm({ encounterId }: { encounterId: string }) {
	const options = useQuery(encounterRecordApi.encounterRecord.orderOptions.queryOptions());
	const [code, setCode] = useState('');
	const [targetOrgId, setTargetOrgId] = useState('');
	const [priority, setPriority] = useState<OrderPriority>('routine');
	const [notes, setNotes] = useState('');
	const create = useRecordMutation(encounterRecordApi.encounterRecord.createOrder);

	return (
		<form
			className={styles.section}
			onSubmit={(event) => {
				event.preventDefault();
				create.mutate(
					{ encounterId, code, targetOrgId, priority, notes: notes.trim() || null },
					{
						onSuccess: () => {
							setCode('');
							setNotes('');
						},
					},
				);
			}}
		>
			<h3 className={styles.sectionTitle}>Order a test</h3>
			<div className={styles.fields}>
				<FormField label='Test'>
					{() => (
						<Select value={code} onValueChange={setCode}>
							<SelectTrigger className={styles.control} aria-label='Test'>
								<SelectValue placeholder='Choose a test' />
							</SelectTrigger>
							<SelectContent>
								{(options.data?.orderableTests ?? []).map((test) => (
									<SelectItem key={test.code} value={test.code}>
										{test.display}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</FormField>
				<FormField label='Send to'>
					{() => (
						<Select value={targetOrgId} onValueChange={setTargetOrgId}>
							<SelectTrigger className={styles.control} aria-label='Send to'>
								<SelectValue placeholder='Lab or imaging facility' />
							</SelectTrigger>
							<SelectContent>
								{(options.data?.orderTargets ?? []).map((facility) => (
									<SelectItem key={facility.id} value={facility.id}>
										{facility.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</FormField>
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
				<FormField label='Notes'>
					{(id) => (
						<Input
							id={id}
							className={styles.control}
							value={notes}
							maxLength={1000}
							placeholder='For the lab, e.g. fasting 8 hours'
							onChange={(event) => setNotes(event.target.value)}
						/>
					)}
				</FormField>
			</div>
			{options.error && <ErrorMessage message={options.error.message} />}
			{create.error && <ErrorMessage message={create.error.message} />}
			<div className={styles.actions}>
				<Button type='submit' size='sm' disabled={!code || !targetOrgId || create.isPending}>
					Order and send
				</Button>
			</div>
		</form>
	);
}
