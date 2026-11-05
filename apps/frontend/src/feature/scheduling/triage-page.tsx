import { VITAL_FIELDS, VITAL_RANGES } from '@loopwise/shared/vitals';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HeartPulse, Megaphone } from 'lucide-react';
import { useState } from 'react';
import styles from './scheduling.module.css';
import { manilaDate, PRIORITY_REASON_LABELS } from './scheduling-format';
import { TicketCode, useSchedulingClinic } from './scheduling-parts';
import { CancelTicketButton, MoveError, TicketItem, useTicketMoves } from './ticket-item';
import type { VitalsFormValues } from '@/feature/encounters/encounter-form-values';
import type { QueueTicketFieldsFragment } from '@/graphql/generated/graphql';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageHeader, PageSection } from '@/components/clinical/page-header';
import pageStyles from '@/components/clinical/page.module.css';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
	emptyVitalsForm,
	noteFormFrom,
	toRecordVitalsInput,
	toUpdateNoteInput,
	validateVitalsForm,
} from '@/feature/encounters/encounter-form-values';
import { FormField } from '@/feature/encounters/form-field';
import { encounterRecordApi } from '@/lib/encounter-record-api';
import { schedulingApi } from '@/lib/scheduling-api';

/**
 * The nurse station (PLAN.md §4.2): call the next patient (the priority lane first), take the vitals and the chief
 * complaint into the visit, and send the patient to their doctor's line. Refreshes every 10 seconds.
 */
export function TriagePage() {
	const { clinicId } = useSchedulingClinic();
	const queryClient = useQueryClient();
	const tickets = useQuery(
		schedulingApi.tickets.queryOptions(
			{ clinicId: clinicId ?? '', date: manilaDate(), station: 'TRIAGE' },
			{ enabled: Boolean(clinicId), refetchInterval: 10_000 },
		),
	);
	const callNext = useMutation(
		schedulingApi.callNext.mutationOptions({
			onSettled: () => queryClient.invalidateQueries(schedulingApi.invalidate),
		}),
	);
	const moves = useTicketMoves();
	const atDesk = tickets.data?.filter((ticket) => ticket.status === 'CALLED' || ticket.status === 'SERVING') ?? [];
	const waiting = tickets.data?.filter((ticket) => ticket.status === 'WAITING') ?? [];
	const skipped = tickets.data?.filter((ticket) => ticket.status === 'SKIPPED') ?? [];

	return (
		<div className={pageStyles.page}>
			<PageHeader
				title='Triage'
				subtitle='Vitals and the chief complaint, then on to the doctor.'
				actions={
					<Button
						disabled={callNext.isPending}
						onClick={() => clinicId && callNext.mutate({ clinicId, station: 'TRIAGE' })}
					>
						<Megaphone />
						Call next
					</Button>
				}
			/>
			{callNext.data === null && callNext.isSuccess && <p role='status'>Nobody is waiting for triage.</p>}
			<MoveError error={callNext.error ?? moves.error} />
			{tickets.isPending ? (
				<Skeleton />
			) : tickets.error ? (
				<ErrorMessage message={tickets.error.message} />
			) : (
				<>
					{atDesk.map((ticket) =>
						ticket.status === 'SERVING' ? (
							<TriagePanel key={ticket.id} ticket={ticket} />
						) : (
							<section key={ticket.id} className={styles.current} aria-label={`Called ${ticket.code}`}>
								<div className={styles.currentHeader}>
									<div>
										<TicketCode ticket={ticket} />{' '}
										<span className={styles.main}>{ticket.patient?.name}</span>
										<div className={styles.muted}>
											Called. Start when the patient is at the desk.
										</div>
									</div>
									<div className={styles.actions}>
										<Button
											size='sm'
											variant='outline'
											disabled={moves.isPending}
											onClick={() => moves.skip.mutate({ ticketId: ticket.id })}
										>
											Not here
										</Button>
										<Button
											size='sm'
											disabled={moves.isPending}
											onClick={() => moves.start.mutate({ ticketId: ticket.id })}
										>
											Start triage
										</Button>
									</div>
								</div>
							</section>
						),
					)}
					<PageSection title='Waiting for triage' meta={String(waiting.length)}>
						{waiting.length === 0 ? (
							<EmptyState icon={HeartPulse} title='Nobody waiting'>
								Patients checked in at the front desk appear here, the priority lane first.
							</EmptyState>
						) : (
							<ul className={styles.ticketList} aria-label='Waiting for triage'>
								{waiting.map((ticket) => (
									<TicketItem key={ticket.id} ticket={ticket}>
										<Button
											size='sm'
											variant='outline'
											disabled={moves.isPending}
											onClick={() => moves.call.mutate({ ticketId: ticket.id })}
										>
											Call
										</Button>
										<CancelTicketButton ticket={ticket} />
									</TicketItem>
								))}
							</ul>
						)}
					</PageSection>
					{skipped.length > 0 && (
						<PageSection title='Not here when called' meta={String(skipped.length)}>
							<ul className={styles.ticketList}>
								{skipped.map((ticket) => (
									<TicketItem key={ticket.id} ticket={ticket}>
										<Button
											size='sm'
											variant='outline'
											disabled={moves.isPending}
											onClick={() => moves.requeue.mutate({ ticketId: ticket.id })}
										>
											Back in line
										</Button>
									</TicketItem>
								))}
							</ul>
						</PageSection>
					)}
				</>
			)}
		</div>
	);
}

/** The patient at the nurse's desk: chief complaint and vitals into the visit, then to the doctor's line. */
function TriagePanel({ ticket }: { ticket: QueueTicketFieldsFragment }) {
	const queryClient = useQueryClient();
	const encounterId = ticket.encounter?.id ?? '';
	const record = useQuery({
		...encounterRecordApi.encounterRecord.get.queryOptions({ encounterId }),
		enabled: Boolean(encounterId),
	});
	const [reason, setReason] = useState<string | null>(null);
	const [vitals, setVitals] = useState<VitalsFormValues>(emptyVitalsForm);
	const [showErrors, setShowErrors] = useState(false);
	const errors = validateVitalsForm(vitals);
	const send = useMutation({
		mutationFn: async () => {
			const encounter = record.data?.encounter;
			if (!encounter) {
				throw new Error("The visit isn't loaded yet.");
			}
			if (VITAL_FIELDS.some((field) => vitals[field].trim() !== '')) {
				await encounterRecordApi.encounterRecord.recordVitals.mutate(toRecordVitalsInput(encounter.id, vitals));
			}
			const complaint = (reason ?? encounter.reason ?? '').trim();
			if (complaint && complaint !== encounter.reason) {
				await encounterRecordApi.encounterRecord.updateNote.mutate(
					toUpdateNoteInput(encounter, { ...noteFormFrom(encounter), reason: complaint }),
				);
			}
			return schedulingApi.send.mutate({ ticketId: ticket.id, station: 'DOCTOR' });
		},
		onSettled: () => queryClient.invalidateQueries(schedulingApi.invalidate),
	});

	return (
		<section className={styles.current} aria-label={`Triage of ${ticket.code}`} data-testid='triage-panel'>
			<div className={styles.currentHeader}>
				<div>
					<TicketCode ticket={ticket} /> <span className={styles.main}>{ticket.patient?.name}</span>
					<div className={styles.muted}>
						{ticket.patient?.patientNo}
						{ticket.priorityReason && ` · ${PRIORITY_REASON_LABELS[ticket.priorityReason]}`} · for{' '}
						{ticket.stationLabel === 'Triage' ? ticket.practitioner?.name : ticket.stationLabel}
					</div>
				</div>
			</div>
			{record.isPending ? (
				<Skeleton />
			) : record.error ? (
				<ErrorMessage message={record.error.message} />
			) : (
				<form
					className={styles.form}
					noValidate
					onSubmit={(event) => {
						event.preventDefault();
						setShowErrors(true);
						if (Object.keys(errors).length === 0) {
							send.mutate();
						}
					}}
				>
					<FormField label='Chief complaint'>
						{(id) => (
							<Input
								id={id}
								value={reason ?? record.data?.encounter.reason ?? ''}
								placeholder='Cough for 3 days'
								onChange={(event) => setReason(event.target.value)}
							/>
						)}
					</FormField>
					<div className={styles.fields}>
						{VITAL_FIELDS.map((field) => (
							<FormField
								key={field}
								label={VITAL_RANGES[field].label}
								unit={VITAL_RANGES[field].unit}
								error={showErrors ? errors[field] : undefined}
							>
								{(id) => (
									<Input
										id={id}
										inputMode='decimal'
										value={vitals[field]}
										onChange={(event) => setVitals({ ...vitals, [field]: event.target.value })}
										aria-invalid={showErrors && errors[field] ? true : undefined}
									/>
								)}
							</FormField>
						))}
					</div>
					{send.error && <ErrorMessage message={send.error.message} />}
					<div className={styles.actions}>
						<Button type='submit' disabled={send.isPending}>
							Send to {ticket.practitioner?.shortName ?? 'the doctor'}
						</Button>
					</div>
				</form>
			)}
		</section>
	);
}
