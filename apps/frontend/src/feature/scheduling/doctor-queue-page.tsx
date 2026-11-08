import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ExternalLink, ListOrdered, Megaphone, Play, Receipt, Stethoscope, UserX } from 'lucide-react';
import { manilaDate, PRIORITY_REASON_LABELS } from './scheduling-format';
import { QueueStatusBadge, TicketCode, useSchedulingClinic, WaitTime } from './scheduling-parts';
import { MoveError, TicketItem, useTicketMoves } from './ticket-item';
import type { QueueTicketFieldsFragment } from '@/graphql/generated/graphql';
import { ClinicalFlag } from '@/components/clinical/clinical-flag';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageHeader } from '@/components/clinical/page-header';
import pageStyles from '@/components/clinical/page.module.css';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { schedulingApi } from '@/lib/scheduling-api';
import { cn } from '@/lib/utils';

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
	// The ticket issued first among the waiting: the longest wait.
	const longest = waiting.reduce<string | null>(
		(oldest, ticket) => (oldest === null || ticket.issuedAt < oldest ? ticket.issuedAt : oldest),
		null,
	);

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
			{callNext.data === null && callNext.isSuccess && (
				<p role='status' className='text-sm text-muted-foreground'>
					Nobody is waiting for you.
				</p>
			)}
			<MoveError error={callNext.error ?? moves.error} />
			{tickets.isPending ? (
				<>
					<Skeleton className='h-36 rounded-xl' />
					<Skeleton className='h-48 rounded-xl' />
				</>
			) : tickets.error ? (
				<ErrorMessage message={tickets.error.message} />
			) : (
				<>
					{withMe.length === 0 ? (
						<div className='flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5'>
							<span className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground'>
								<Stethoscope className='size-4' aria-hidden />
							</span>
							<div className='min-w-0'>
								<p className='text-sm font-medium text-foreground'>Nobody with you</p>
								{waiting.length > 0 && (
									<p className='text-sm text-muted-foreground'>
										Call next brings in the first patient waiting.
									</p>
								)}
							</div>
						</div>
					) : (
						withMe.map((ticket) => <CurrentPatient key={ticket.id} ticket={ticket} moves={moves} />)
					)}
					<section className='flex flex-col gap-3' aria-labelledby='my-queue-waiting'>
						<div className='flex items-center justify-between gap-3'>
							<h2 id='my-queue-waiting' className='text-base font-semibold text-foreground'>
								Waiting for you{' '}
								<span className='font-normal text-muted-foreground'>({waiting.length})</span>
							</h2>
							{longest != null && (
								<p className='text-sm text-muted-foreground'>
									Longest wait <WaitTime since={longest} srPrefix={null} />
								</p>
							)}
						</div>
						{waiting.length === 0 ? (
							<EmptyState icon={ListOrdered} title='Nobody waiting'>
								Patients the nurse sends to you appear here.
							</EmptyState>
						) : (
							<ul
								className='grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(22rem,100%),1fr))]'
								aria-label='Waiting for you'
							>
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
											<Megaphone />
											Call
										</Button>
									</TicketItem>
								))}
							</ul>
						)}
					</section>
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
		<section
			className={cn(
				'flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-xs sm:p-5',
				serving ? 'border-info/40' : 'border-abnormal-line',
			)}
			aria-label={`With you: ${ticket.code}`}
			data-testid='doctor-current'
		>
			<div className='flex flex-wrap items-start gap-4'>
				<TicketCode ticket={ticket} size='lg' />
				<div className='flex min-w-0 flex-1 flex-col gap-1'>
					<p className='text-sm text-muted-foreground'>
						{serving ? 'With you now' : 'Called, on the way to your room'}
					</p>
					<p className='truncate text-lg font-semibold text-foreground'>{ticket.patient?.name}</p>
					<p className='text-sm text-muted-foreground'>{ticket.encounter?.reason ?? 'No reason given'}</p>
					<div className='mt-1 flex flex-wrap items-center gap-2'>
						<QueueStatusBadge status={ticket.status} />
						{ticket.priorityReason && (
							<ClinicalFlag tone='critical' icon={null}>
								{PRIORITY_REASON_LABELS[ticket.priorityReason]}
							</ClinicalFlag>
						)}
						{ticket.encounter && (
							<span className='text-xs text-muted-foreground tabular-nums'>
								{ticket.encounter.encounterNo}
							</span>
						)}
					</div>
				</div>
			</div>
			<div className='flex flex-wrap items-center justify-end gap-2 border-t pt-4'>
				{!serving && (
					<>
						<Button
							size='sm'
							variant='outline'
							disabled={moves.isPending}
							onClick={() => moves.skip.mutate({ ticketId: ticket.id })}
						>
							<UserX />
							Not here
						</Button>
						<Button
							size='sm'
							disabled={moves.isPending}
							onClick={() => moves.start.mutate({ ticketId: ticket.id })}
						>
							<Play />
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
							<Receipt />
							Send to cashier
						</Button>
					</>
				)}
			</div>
		</section>
	);
}
