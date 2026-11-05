import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import styles from './scheduling.module.css';
import { manilaTime } from './scheduling-format';
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

	return (
		<main className={styles.board} data-testid='queue-board'>
			<header className={styles.boardHeader}>
				<h1 className={styles.boardTitle}>{board.data?.clinicName ?? 'Queue'}</h1>
				<span className={styles.boardClock} aria-label='Time now'>
					{manilaTime(now)}
				</span>
			</header>
			{isPending || board.isPending ? (
				<Skeleton />
			) : board.error ? (
				<ErrorMessage message={board.error.message} />
			) : (
				<div className={styles.boardColumns}>
					<section className={styles.boardPanel} aria-labelledby='board-now'>
						<h2 id='board-now' className={styles.boardPanelTitle}>
							Now serving
						</h2>
						<ul className={styles.ticketList} aria-live='polite'>
							{board.data.nowServing.map((ticket) => (
								<li
									key={ticket.id}
									className={cn(styles.boardRow, ticket.status === 'CALLED' && styles.boardRowCalled)}
									data-testid='board-now'
								>
									<span className={cn(styles.boardCode, ticket.isPriority && styles.priorityCode)}>
										{ticket.code}
									</span>
									<span className={styles.boardStation}>
										{ticket.status === 'CALLED' ? 'Please go to ' : ''}
										{ticket.stationLabel}
									</span>
								</li>
							))}
							{board.data.nowServing.length === 0 && (
								<li className={styles.boardNote}>No one called yet.</li>
							)}
						</ul>
					</section>
					<section className={styles.boardPanel} aria-labelledby='board-waiting'>
						<h2 id='board-waiting' className={styles.boardPanelTitle}>
							Waiting
						</h2>
						<ul className={styles.boardWaiting}>
							{board.data.waiting.map((ticket) => (
								<li
									key={ticket.id}
									className={cn(styles.boardWaitingCode, ticket.isPriority && styles.priorityCode)}
									data-testid='board-waiting'
								>
									{ticket.code}
								</li>
							))}
						</ul>
						<p className={styles.boardNote}>
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
