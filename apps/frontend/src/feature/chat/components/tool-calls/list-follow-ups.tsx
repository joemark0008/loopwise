import { Link } from '@tanstack/react-router';
import { CalendarCheck, Send } from 'lucide-react';
import { memo } from 'react';
import styles from './propose-action.module.css';
import type { listFollowUps, listReferrals } from '@loopwise/shared/tools';
import type { ToolCallComponentProps } from '.';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDay } from '@/feature/encounters/encounter-format';

/*
 * Wise's follow-up and referral reads (DESIGN.md §6): lists with a link to their page. Booking a follow-up is the
 * `propose_appointment` card; answering a referral is the Referrals page.
 */

const TIMING_LABEL = (row: listFollowUps.FollowUp) =>
	row.timing === 'OVERDUE'
		? `overdue ${-row.daysFromToday} d`
		: row.timing === 'DUE'
			? 'due today'
			: `in ${row.daysFromToday} d`;

/** `list_follow_ups`: who is due back, overdue first. */
export const ListFollowUpsToolCall = memo(({ toolPart }: ToolCallComponentProps<'list_follow_ups'>) => {
	if (toolPart.state === 'input-streaming' || toolPart.state === 'input-available') {
		return <Skeleton className={styles.skeleton} />;
	}
	if (toolPart.state === 'output-error') {
		return <ErrorMessage message={toolPart.errorText} />;
	}
	const output = toolPart.output as listFollowUps.Output | undefined;
	if (!output) {
		return null;
	}
	return (
		<div className={styles.resultsCard} data-testid='follow-ups'>
			<p className={styles.resultsTitle}>
				<CalendarCheck aria-hidden /> Follow-ups due within {output.withinDays} days
				{output.doctor && ` · ${output.doctor}`} ({output.followUps.length}
				{output.truncated && '+'})
				<Link to='/follow-ups' className={styles.link}>
					Open follow-ups
				</Link>
			</p>
			{output.followUps.length === 0 ? (
				<p className={styles.meta}>Nobody is due back.</p>
			) : (
				<ul className={styles.list}>
					{output.followUps.map((row) => (
						<li key={row.encounterId}>
							<strong>{formatDay(row.followUpDate)}</strong> ({TIMING_LABEL(row)}) · {row.patient.name}
							{row.doctor && ` · ${row.doctor.name}`}
							{row.diagnosis && ` · ${row.diagnosis}`}
						</li>
					))}
				</ul>
			)}
		</div>
	);
});

/** `list_referrals`: the user's inbox or sent referrals, pending by default. */
export const ListReferralsToolCall = memo(({ toolPart }: ToolCallComponentProps<'list_referrals'>) => {
	if (toolPart.state === 'input-streaming' || toolPart.state === 'input-available') {
		return <Skeleton className={styles.skeleton} />;
	}
	if (toolPart.state === 'output-error') {
		return <ErrorMessage message={toolPart.errorText} />;
	}
	const output = toolPart.output as listReferrals.Output | undefined;
	if (!output) {
		return null;
	}
	return (
		<div className={styles.resultsCard} data-testid='referrals'>
			<p className={styles.resultsTitle}>
				<Send aria-hidden /> {output.box === 'inbox' ? 'Referrals to you' : 'Referrals you sent'} (
				{output.referrals.length}
				{output.truncated && '+'})
				<Link
					to='/referrals'
					search={{ box: output.box === 'inbox' ? undefined : 'outbox' }}
					className={styles.link}
				>
					Open referrals
				</Link>
			</p>
			{output.referrals.length === 0 ? (
				<p className={styles.meta}>No pending referrals.</p>
			) : (
				<ul className={styles.list}>
					{output.referrals.map((referral) => (
						<li key={referral.id}>
							<strong>{referral.patient.name}</strong> · {referral.counterpart} · {referral.reason} ·{' '}
							{referral.status.toLowerCase()}
						</li>
					))}
				</ul>
			)}
		</div>
	);
});
