import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { CalendarDays, ListOrdered, MonitorPlay, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { CheckInDialog } from './check-in-dialog';
import styles from './scheduling.module.css';
import { manilaDate } from './scheduling-format';
import { useSchedulingClinic } from './scheduling-parts';
import { CancelTicketButton, MoveError, TicketItem, useTicketMoves } from './ticket-item';
import type { QueueTicketFieldsFragment } from '@/graphql/generated/graphql';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageHeader, PageSection } from '@/components/clinical/page-header';
import pageStyles from '@/components/clinical/page.module.css';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { useDesks } from '@/hooks/use-staff-role';
import { schedulingApi } from '@/lib/scheduling-api';

const OPEN = new Set(['WAITING', 'CALLED', 'SERVING', 'SKIPPED']);

interface Line {
	key: string;
	title: string;
	tickets: QueueTicketFieldsFragment[];
}

/** The day's lines, in call order: triage, each doctor's room, the cashier. */
export function linesOf(tickets: QueueTicketFieldsFragment[]): Line[] {
	const open = tickets.filter((ticket) => OPEN.has(ticket.status));
	const doctors = new Map<string, Line>();
	for (const ticket of open.filter((candidate) => candidate.station === 'DOCTOR')) {
		const key = ticket.practitioner?.id ?? 'doctor';
		const line = doctors.get(key) ?? { key, title: ticket.stationLabel, tickets: [] };
		line.tickets.push(ticket);
		doctors.set(key, line);
	}
	return [
		{ key: 'triage', title: 'Triage', tickets: open.filter((ticket) => ticket.station === 'TRIAGE') },
		...doctors.values(),
		{ key: 'cashier', title: 'Cashier', tickets: open.filter((ticket) => ticket.station === 'CASHIER') },
	];
}

/**
 * The front desk's queue control (PLAN.md §4.2): today's lines at every station, walk-in check-in, bringing back a
 * patient who wasn't there when called, and cancelling a visit the patient left. The cashier works its line here too.
 * Refreshes every 15 seconds.
 */
export function QueuePage() {
	const { clinicId } = useSchedulingClinic();
	const desks = useDesks();
	const [checkingIn, setCheckingIn] = useState(false);
	const [issued, setIssued] = useState<QueueTicketFieldsFragment | null>(null);
	const tickets = useQuery(
		schedulingApi.tickets.queryOptions(
			{ clinicId: clinicId ?? '', date: manilaDate() },
			{ enabled: Boolean(clinicId), refetchInterval: 15_000 },
		),
	);
	const moves = useTicketMoves();
	const isCashier = desks.includes('cashier');
	const done = tickets.data?.filter((ticket) => ticket.status === 'DONE' || ticket.status === 'CANCELLED') ?? [];

	return (
		<div className={pageStyles.page}>
			<PageHeader
				title='Queue'
				subtitle="Today's lines, the priority lane first."
				actions={
					<>
						<Button variant='outline' asChild>
							<Link to='/appointments'>
								<CalendarDays />
								Appointments
							</Link>
						</Button>
						<Button variant='outline' asChild>
							<a href='/board' target='_blank' rel='noreferrer'>
								<MonitorPlay />
								Open the board
							</a>
						</Button>
						<Button onClick={() => setCheckingIn(true)}>
							<UserPlus />
							Walk-in
						</Button>
					</>
				}
			/>
			{issued && (
				<p role='status' className={styles.main}>
					{issued.patient?.name ?? 'Patient'} checked in: number {issued.code}.
				</p>
			)}
			<MoveError error={moves.error} />
			{tickets.isPending ? (
				<Skeleton />
			) : tickets.error ? (
				<ErrorMessage message={tickets.error.message} />
			) : (
				<div className={styles.lines}>
					{linesOf(tickets.data).map((line) => (
						<PageSection key={line.key} title={line.title} meta={String(line.tickets.length)}>
							{line.tickets.length === 0 ? (
								<EmptyState icon={ListOrdered} title='Nobody in line' />
							) : (
								<ul className={styles.ticketList} aria-label={`${line.title} line`}>
									{line.tickets.map((ticket) => (
										<TicketItem key={ticket.id} ticket={ticket}>
											{ticket.status === 'SKIPPED' && (
												<Button
													size='sm'
													variant='outline'
													disabled={moves.isPending}
													onClick={() => moves.requeue.mutate({ ticketId: ticket.id })}
												>
													Back in line
												</Button>
											)}
											{isCashier &&
												ticket.station === 'CASHIER' &&
												ticket.status !== 'SERVING' && (
													<Button
														size='sm'
														disabled={moves.isPending}
														onClick={() => moves.start.mutate({ ticketId: ticket.id })}
													>
														Serve
													</Button>
												)}
											{isCashier &&
												ticket.station === 'CASHIER' &&
												ticket.status === 'SERVING' && (
													<Button
														size='sm'
														disabled={moves.isPending}
														onClick={() => moves.complete.mutate({ ticketId: ticket.id })}
													>
														Done
													</Button>
												)}
											{ticket.encounter?.status === 'OPEN' && (
												<CancelTicketButton ticket={ticket} />
											)}
										</TicketItem>
									))}
								</ul>
							)}
						</PageSection>
					))}
				</div>
			)}
			{done.length > 0 && (
				<PageSection title='Done today' meta={String(done.length)}>
					<ul className={styles.ticketList}>
						{done.map((ticket) => (
							<TicketItem key={ticket.id} ticket={ticket} />
						))}
					</ul>
				</PageSection>
			)}
			<CheckInDialog clinicId={clinicId} open={checkingIn} onOpenChange={setCheckingIn} onCheckedIn={setIssued} />
		</div>
	);
}
