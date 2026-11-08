import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { dayLabel, manilaDate, manilaTime } from './scheduling-format';
import { useSchedulingClinic } from './scheduling-parts';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { schedulingApi } from '@/lib/scheduling-api';
import { cn } from '@/lib/utils';

/** How often the board asks for the queue: a TV in the waiting room, polling is enough. */
const POLL_MS = 5_000;

/**
 * The waiting-room board: the numbers being called and where to go, and the numbers waiting (the priority lane
 * first). Numbers and stations only, never a name or a reason (RA 10173). Full screen, polls every 5 seconds.
 */
export function QueueBoardPage() {
	const { clinicId, isPending } = useSchedulingClinic();
	const board = useQuery(
		schedulingApi.board.queryOptions(
			{ clinicId: clinicId ?? '' },
			{ enabled: Boolean(clinicId), refetchInterval: POLL_MS },
		),
	);
	const now = useClock();

	const today = manilaDate(now);
	const waitingCount = board.data?.waiting.length ?? 0;

	return (
		<main
			className='flex min-h-dvh flex-col gap-6 bg-background p-6 text-foreground lg:p-10'
			data-testid='queue-board'
		>
			<header className='flex flex-wrap items-end justify-between gap-4 border-b pb-5'>
				<div className='flex flex-col gap-1'>
					<h1 className='font-display text-3xl font-semibold lg:text-4xl'>
						{board.data?.clinicName ?? 'Queue'}
					</h1>
					<p className='text-lg text-muted-foreground'>Please wait for your number.</p>
				</div>
				<div className='flex flex-col items-end'>
					<span
						className='font-display text-4xl font-semibold tabular-nums lg:text-5xl'
						aria-label='Time now'
					>
						{manilaTime(now)}
					</span>
					<span className='text-lg text-muted-foreground'>{dayLabel(today)}</span>
				</div>
			</header>
			{isPending || board.isPending ? (
				<div className='grid flex-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]'>
					<Skeleton className='rounded-2xl' />
					<Skeleton className='rounded-2xl' />
				</div>
			) : board.error ? (
				<ErrorMessage message={board.error.message} />
			) : (
				<div className='grid flex-1 items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]'>
					<section className='flex flex-col gap-4' aria-labelledby='board-now'>
						<h2 id='board-now' className='text-2xl font-semibold'>
							Now serving
						</h2>
						<ul className='flex flex-col gap-3' aria-live='polite'>
							{board.data.nowServing.map((ticket) => {
								const called = ticket.status === 'CALLED';
								return (
									<li
										key={ticket.id}
										className={cn(
											'flex flex-col items-start gap-2 rounded-2xl border px-6 py-5 sm:flex-row sm:items-center sm:gap-8 lg:px-8 lg:py-8',
											called ? 'border-abnormal-line bg-abnormal-bg' : 'bg-card',
										)}
										data-testid='board-now'
									>
										<span
											className={cn(
												'font-display text-6xl font-bold tabular-nums lg:text-8xl',
												ticket.isPriority && 'text-critical',
											)}
										>
											{ticket.code}
										</span>
										<span className='flex min-w-0 items-center gap-3 sm:flex-1 sm:justify-end sm:text-right'>
											<ArrowRight className='size-8 shrink-0 text-muted-foreground' aria-hidden />
											<span className='flex flex-col'>
												{called && (
													<span className='text-lg font-medium text-abnormal'>
														Please go to
													</span>
												)}
												<span className='text-2xl font-semibold lg:text-3xl'>
													{ticket.stationLabel}
												</span>
											</span>
										</span>
									</li>
								);
							})}
							{board.data.nowServing.length === 0 && (
								<li className='rounded-2xl border border-dashed px-6 py-10 text-center text-xl text-muted-foreground'>
									No one called yet.
								</li>
							)}
						</ul>
					</section>
					<section className='flex flex-col gap-4' aria-labelledby='board-waiting'>
						<h2 id='board-waiting' className='flex items-baseline gap-3 text-2xl font-semibold'>
							Waiting
							<span className='text-lg font-normal text-muted-foreground tabular-nums'>
								{waitingCount}
							</span>
						</h2>
						{waitingCount === 0 ? (
							<p className='rounded-2xl border border-dashed px-6 py-10 text-center text-xl text-muted-foreground'>
								No one waiting.
							</p>
						) : (
							<ul className='grid grid-cols-2 gap-3'>
								{board.data.waiting.map((ticket) => (
									<li
										key={ticket.id}
										className={cn(
											'rounded-xl px-3 py-5 text-center font-display text-4xl font-semibold whitespace-nowrap tabular-nums lg:py-8 lg:text-6xl',
											ticket.isPriority
												? 'bg-critical-bg text-critical'
												: 'bg-muted text-foreground',
										)}
										data-testid='board-waiting'
									>
										{ticket.code}
									</li>
								))}
							</ul>
						)}
						<p className='flex items-start gap-3 text-base text-muted-foreground'>
							<span className='shrink-0 rounded-md bg-critical-bg px-2 py-0.5 font-display font-semibold text-critical'>
								P
							</span>
							P numbers are the priority lane: seniors, PWDs, pregnant women, those with an infant, and
							emergencies.
						</p>
					</section>
				</div>
			)}
		</main>
	);
}

function useClock(): Date {
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		const timer = setInterval(() => setNow(new Date()), 30_000);
		return () => clearInterval(timer);
	}, []);
	return now;
}
