import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ExternalLink, ListOrdered, Megaphone } from 'lucide-react';
import styles from './scheduling.module.css';
import { manilaDate, PRIORITY_REASON_LABELS } from './scheduling-format';
import { TicketCode, useSchedulingClinic } from './scheduling-parts';
import { MoveError, TicketItem, useTicketMoves } from './ticket-item';
import type { QueueTicketFieldsFragment } from '@/graphql/generated/graphql';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageHeader, PageSection } from '@/components/clinical/page-header';
import pageStyles from '@/components/clinical/page.module.css';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { schedulingApi } from '@/lib/scheduling-api';

/**
 * The doctor's own line (PLAN.md §4.2): the patients triage sent to them, the priority lane first. Calling and
 * starting a patient starts the visit (OPEN → IN_PROGRESS); sending them to the cashier puts the visit up for
 * billing, and Done closes a visit with nothing to bill. A waiting patient's visit opens from the line too: starting the
 * consult there (or on the AI scribe tab) moves the ticket to the room as well. Refreshes every 10 seconds.
 */
export function DoctorQueuePage() {
	const { clinicId } = useSchedulingClinic();
	const queryClient = useQueryClient();
	const tickets = useQuery(
		schedulingApi.tickets.queryOptions(
			{ clinicId: clinicId ?? '', date: manilaDate(), mine: true },
			{ enabled: Boolean(clinicId), refetchInterval: 10_000 },
		),
	);
	const callNext = useMutation(
		schedulingApi.callNext.mutationOptions({
			onSettled: () => queryClient.invalidateQueries(schedulingApi.invalidate),
		}),
	);
	const moves = useTicketMoves();
	const withMe = tickets.data?.filter((ticket) => ticket.status === 'CALLED' || ticket.status === 'SERVING') ?? [];
	const waiting = tickets.data?.filter((ticket) => ticket.status === 'WAITING') ?? [];

	return (
		<div className={pageStyles.page}>
			<PageHeader
				title='My queue'
				subtitle='Your patients today, after triage. The priority lane first.'
				actions={
					<Button
						disabled={callNext.isPending}
						onClick={() => clinicId && callNext.mutate({ clinicId, station: 'DOCTOR' })}
					>
						<Megaphone />
						Call next
					</Button>
				}
			/>
			{callNext.data === null && callNext.isSuccess && <p role='status'>Nobody is waiting for you.</p>}
			<MoveError error={callNext.error ?? moves.error} />
			{tickets.isPending ? (
				<Skeleton />
			) : tickets.error ? (
				<ErrorMessage message={tickets.error.message} />
			) : (
				<>
					{withMe.map((ticket) => (
						<CurrentPatient key={ticket.id} ticket={ticket} moves={moves} />
					))}
					<PageSection title='Waiting for you' meta={String(waiting.length)}>
						{waiting.length === 0 ? (
							<EmptyState icon={ListOrdered} title='Nobody waiting'>
								Patients the nurse sends to you appear here.
							</EmptyState>
						) : (
							<ul className={styles.ticketList} aria-label='Waiting for you'>
								{waiting.map((ticket) => (
									<TicketItem key={ticket.id} ticket={ticket}>
										{ticket.encounter && ticket.patient && (
											<Button size='sm' variant='ghost-muted' asChild>
												<Link
													to='/patients/$patientId/encounters/$encounterId'
													params={{
														patientId: ticket.patient.id,
														encounterId: ticket.encounter.id,
													}}
												>
													Open visit
												</Link>
											</Button>
										)}
										<Button
											size='sm'
											variant='outline'
											disabled={moves.isPending}
											onClick={() => moves.call.mutate({ ticketId: ticket.id })}
										>
											Call
										</Button>
									</TicketItem>
								))}
							</ul>
						)}
					</PageSection>
				</>
			)}
		</div>
	);
}

function CurrentPatient({
	ticket,
	moves,
}: {
	ticket: QueueTicketFieldsFragment;
	moves: ReturnType<typeof useTicketMoves>;
}) {
	const serving = ticket.status === 'SERVING';
	return (
		<section className={styles.current} aria-label={`With you: ${ticket.code}`} data-testid='doctor-current'>
			<div className={styles.currentHeader}>
				<div>
					<TicketCode ticket={ticket} /> <span className={styles.main}>{ticket.patient?.name}</span>
					<div className={styles.muted}>
						{ticket.encounter?.reason ?? 'No reason given'}
						{ticket.priorityReason && ` · ${PRIORITY_REASON_LABELS[ticket.priorityReason]}`}
						{ticket.encounter && ` · ${ticket.encounter.encounterNo}`}
					</div>
				</div>
				<div className={styles.actions}>
					{!serving && (
						<>
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
								Start visit
							</Button>
						</>
					)}
					{serving && ticket.encounter && ticket.patient && (
						<Button size='sm' variant='outline' asChild>
							<Link
								to='/patients/$patientId/encounters/$encounterId'
								params={{ patientId: ticket.patient.id, encounterId: ticket.encounter.id }}
							>
								<ExternalLink />
								Open the visit
							</Link>
						</Button>
					)}
					{serving && (
						<>
							<Button
								size='sm'
								variant='outline'
								disabled={moves.isPending}
								onClick={() => moves.complete.mutate({ ticketId: ticket.id })}
							>
								Done, nothing to bill
							</Button>
							<Button
								size='sm'
								disabled={moves.isPending}
								onClick={() => moves.send.mutate({ ticketId: ticket.id, station: 'CASHIER' })}
							>
								Send to cashier
							</Button>
						</>
					)}
				</div>
			</div>
		</section>
	);
}
