import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
	CalendarDays,
	ChevronDown,
	CircleCheck,
	HeartPulse,
	ListOrdered,
	MonitorPlay,
	Receipt,
	Stethoscope,
	Undo2,
	UserPlus,
	X,
} from 'lucide-react';
import { useState } from 'react';
import { CheckInDialog } from './check-in-dialog';
import { LONG_WAIT_MIN, queueSummary } from './queue-summary';
import { manilaDate } from './scheduling-format';
import { StatStrip, TicketCode, useSchedulingClinic } from './scheduling-parts';
import { CancelTicketButton, MoveError, TicketItem, useTicketMoves } from './ticket-item';
import type { QueueTicketFieldsFragment } from '@/graphql/generated/graphql';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/clinical/page-header';
import pageStyles from '@/components/clinical/page.module.css';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { useDesks } from '@/hooks/use-staff-role';
import { schedulingApi } from '@/lib/scheduling-api';
import { cn } from '@/lib/utils';

const OPEN = new Set(['WAITING', 'CALLED', 'SERVING', 'SKIPPED']);

interface Line {
	key: string;
	title: string;
	station: 'triage' | 'doctor' | 'cashier';
	tickets: QueueTicketFieldsFragment[];
}

/** The day's lines, in call order: triage, each doctor's room, the cashier. */
export function linesOf(tickets: QueueTicketFieldsFragment[]): Line[] {
	const open = tickets.filter((ticket) => OPEN.has(ticket.status));
	const doctors = new Map<string, Line>();
	for (const ticket of open.filter((candidate) => candidate.station === 'DOCTOR')) {
		const key = ticket.practitioner?.id ?? 'doctor';
		const line = doctors.get(key) ?? { key, title: ticket.stationLabel, station: 'doctor' as const, tickets: [] };
		line.tickets.push(ticket);
		doctors.set(key, line);
	}
	return [
		{
			key: 'triage',
			title: 'Triage',
			station: 'triage',
			tickets: open.filter((ticket) => ticket.station === 'TRIAGE'),
		},
		...doctors.values(),
		{
			key: 'cashier',
			title: 'Cashier',
			station: 'cashier',
			tickets: open.filter((ticket) => ticket.station === 'CASHIER'),
		},
	];
}

/**
 * The front desk's queue control (PLAN.md §4.2): today's figures, then the lines at every station as lanes of ticket
 * cards (walk-in check-in, bringing back a patient who wasn't there when called, cancelling a visit the patient left).
 * The cashier works its line here too. Refreshes every 15 seconds.
 */
export function QueuePage() {
	const { clinicId } = useSchedulingClinic();
	const desks = useDesks();
	const [checkingIn, setCheckingIn] = useState(false);
	const [issued, setIssued] = useState<QueueTicketFieldsFragment | null>(null);
	const [showDone, setShowDone] = useState(true);
	const tickets = useQuery(
		schedulingApi.tickets.queryOptions(
			{ clinicId: clinicId ?? '', date: manilaDate() },
			{ enabled: Boolean(clinicId), refetchInterval: 15_000 },
		),
	);
	const moves = useTicketMoves();
	const isCashier = desks.includes('cashier');
	const done = tickets.data?.filter((ticket) => ticket.status === 'DONE' || ticket.status === 'CANCELLED') ?? [];
	const summary = tickets.data ? queueSummary(tickets.data) : undefined;

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
			{issued && <CheckedIn ticket={issued} onDismiss={() => setIssued(null)} />}
			<StatStrip
				label="Today's queue"
				stats={[
					{
						label: 'Waiting',
						value: summary?.waiting,
						hint:
							summary?.longestWait != null ? (
								<>
									Longest <WaitMinutes minutes={summary.longestWait} />
								</>
							) : (
								'Nobody waiting'
							),
					},
					{ label: 'At a desk', value: summary?.atDesk, hint: 'Called or being seen' },
					{ label: 'Not here', value: summary?.notHere, hint: 'Called, did not come' },
					{ label: 'Done today', value: summary?.done, hint: 'Visits finished' },
				]}
			/>
			<MoveError error={moves.error} />
			{tickets.isPending ? (
				<div className='grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(19rem,1fr))]'>
					{Array.from({ length: 3 }, (_, index) => (
						<Skeleton key={index} className='h-64 rounded-xl' />
					))}
				</div>
			) : tickets.error ? (
				<ErrorMessage message={tickets.error.message} />
			) : (
				<div className='grid items-start gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(19rem,100%),1fr))]'>
					{linesOf(tickets.data).map((line) => (
						<Lane key={line.key} line={line}>
							{(ticket) => (
								<TicketItem key={ticket.id} ticket={ticket}>
									{ticket.status === 'SKIPPED' && (
										<Button
											size='sm'
											variant='outline'
											disabled={moves.isPending}
											onClick={() => moves.requeue.mutate({ ticketId: ticket.id })}
										>
											<Undo2 />
											Back in line
										</Button>
									)}
									{ticket.encounter?.status === 'OPEN' && <CancelTicketButton ticket={ticket} />}
									{isCashier &&
										ticket.station === 'CASHIER' &&
										ticket.patient &&
										ticket.encounter && (
											<Button size='sm' variant='outline' asChild>
												<Link
													to='/patients/$patientId/encounters/$encounterId'
													params={{
														patientId: ticket.patient.id,
														encounterId: ticket.encounter.id,
													}}
													search={{ tab: 'billing' }}
												>
													Bill
												</Link>
											</Button>
										)}
									{isCashier && ticket.station === 'CASHIER' && ticket.status !== 'SERVING' && (
										<Button
											size='sm'
											disabled={moves.isPending}
											onClick={() => moves.start.mutate({ ticketId: ticket.id })}
										>
											Serve
										</Button>
									)}
									{isCashier && ticket.station === 'CASHIER' && ticket.status === 'SERVING' && (
										<Button
											size='sm'
											disabled={moves.isPending}
											onClick={() => moves.complete.mutate({ ticketId: ticket.id })}
										>
											Done
										</Button>
									)}
								</TicketItem>
							)}
						</Lane>
					))}
				</div>
			)}
			{done.length > 0 && (
				<section className='rounded-xl border bg-card' aria-labelledby='queue-done'>
					<div className='flex items-center justify-between gap-3 px-4 py-3'>
						<h2 id='queue-done' className='flex items-center gap-2 text-sm font-semibold text-foreground'>
							Done today
							<CountPill count={done.length} />
						</h2>
						<Button
							size='sm'
							variant='ghost-muted'
							aria-expanded={showDone}
							aria-controls='queue-done-list'
							onClick={() => setShowDone((shown) => !shown)}
						>
							{showDone ? 'Hide' : 'Show'}
							<ChevronDown
								className={cn(
									'transition-transform motion-reduce:transition-none',
									showDone && 'rotate-180',
								)}
							/>
						</Button>
					</div>
					<ul
						id='queue-done-list'
						hidden={!showDone}
						className={cn('flex flex-col gap-2 border-t p-3', !showDone && 'hidden')}
						aria-label='Done today'
					>
						{done.map((ticket) => (
							<TicketItem key={ticket.id} ticket={ticket} compact />
						))}
					</ul>
				</section>
			)}
			<CheckInDialog clinicId={clinicId} open={checkingIn} onOpenChange={setCheckingIn} onCheckedIn={setIssued} />
		</div>
	);
}

const LANE_ICON: Record<Line['station'], LucideIcon> = {
	triage: HeartPulse,
	doctor: Stethoscope,
	cashier: Receipt,
};

/** One station's line, kanban style: its name and head count over its ticket cards. */
function Lane({ line, children }: { line: Line; children: (ticket: QueueTicketFieldsFragment) => ReactNode }) {
	const Icon = LANE_ICON[line.station];
	const id = `lane-${line.key}`;
	return (
		<section className='flex min-w-0 flex-col gap-3 rounded-xl bg-muted/60 p-3' aria-labelledby={id}>
			<div className='flex items-center gap-2 px-1'>
				<Icon className='size-4 shrink-0 text-muted-foreground' aria-hidden />
				<h2 id={id} className='min-w-0 flex-1 truncate text-sm font-semibold text-foreground'>
					{line.title}
				</h2>
				<CountPill count={line.tickets.length} />
			</div>
			{line.tickets.length === 0 ? (
				<div className='flex flex-col items-center gap-1 rounded-lg border border-dashed border-control-line/40 px-4 py-8 text-center'>
					<ListOrdered className='size-5 text-muted-foreground' aria-hidden />
					<p className='text-sm font-medium text-foreground'>Nobody in line</p>
				</div>
			) : (
				<ul className='flex flex-col gap-2' aria-label={`${line.title} line`}>
					{line.tickets.map(children)}
				</ul>
			)}
		</section>
	);
}

function CountPill({ count }: { count: number }) {
	return (
		<span className='inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1.5 text-xs font-medium text-foreground tabular-nums ring-1 ring-border'>
			{count}
		</span>
	);
}

function WaitMinutes({ minutes }: { minutes: number }) {
	return (
		<span className={cn('tabular-nums', minutes >= LONG_WAIT_MIN && 'font-medium text-abnormal')}>
			{minutes < 60
				? `${minutes} min`
				: `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`}
		</span>
	);
}

/** The number just issued, big enough to read out to the patient. */
function CheckedIn({ ticket, onDismiss }: { ticket: QueueTicketFieldsFragment; onDismiss: () => void }) {
	return (
		<div className='flex items-center gap-4 rounded-xl border border-done/30 bg-done-bg px-4 py-3'>
			<CircleCheck className='size-5 shrink-0 text-done' aria-hidden />
			<p role='status' className='min-w-0 flex-1 text-sm text-foreground'>
				<span className='font-semibold'>{ticket.patient?.name ?? 'Patient'}</span> checked in: number{' '}
				<span className='font-semibold'>{ticket.code}</span>.
			</p>
			<TicketCode ticket={ticket} size='lg' className='hidden sm:inline-flex' />
			<Button size='icon-sm' variant='ghost-muted' onClick={onDismiss} aria-label='Dismiss'>
				<X />
			</Button>
		</div>
	);
}
