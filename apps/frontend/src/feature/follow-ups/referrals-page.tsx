import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Inbox, Printer, Send } from 'lucide-react';
import { useState } from 'react';
import styles from './follow-ups.module.css';
import { ReferralResponseDialog } from './referral-response-dialog';
import type { ReferralAnswer } from './referral-response-dialog';
import type { ClinicalTone } from '@/components/clinical/clinical-flag';
import type { ReferralBox, ReferralListFieldsFragment, ReferralStatus } from '@/graphql/generated/graphql';
import { ClinicalFlag } from '@/components/clinical/clinical-flag';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageHeader, PageSection } from '@/components/clinical/page-header';
import pageStyles from '@/components/clinical/page.module.css';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { TabBar, TabPanel } from '@/components/ui/tab-bar';
import { formatDate } from '@/feature/encounters/encounter-format';
import { useSchedulingClinic } from '@/feature/scheduling/scheduling-parts';
import { usePermissions } from '@/hooks/use-permissions';
import { referralApi } from '@/lib/follow-up-api';

export type ReferralsTab = 'inbox' | 'outbox' | 'clinic';

export interface ReferralsSearch {
	box?: ReferralsTab;
}

const BOX: Record<ReferralsTab, ReferralBox> = { inbox: 'INBOX', outbox: 'OUTBOX', clinic: 'CLINIC' };

export const REFERRAL_STATUS: Record<ReferralStatus, { label: string; tone: ClinicalTone }> = {
	DRAFT: { label: 'Draft', tone: 'draft' },
	SENT: { label: 'Waiting for an answer', tone: 'info' },
	ACCEPTED: { label: 'Accepted', tone: 'info' },
	COMPLETED: { label: 'Completed', tone: 'done' },
	DECLINED: { label: 'Declined', tone: 'void' },
	CANCELLED: { label: 'Cancelled', tone: 'void' },
};

const URGENCY_LABELS: Record<string, string> = { ROUTINE: 'Routine', URGENT: 'Urgent', STAT: 'STAT' };

/** Who the referral goes to, as a line. */
export function referralTarget(referral: ReferralListFieldsFragment): string {
	return referral.isInternal
		? (referral.toPractitioner?.displayName ?? 'A colleague')
		: [referral.toExternalDoctor, referral.toFacility].filter(Boolean).join(', ');
}

/**
 * Referrals (DESIGN.md §6): the inbox (sent to the user by colleagues of the organization, answered here) and the
 * outbox (sent by the user; outside referrals are marked here by the referring side), and for clinic admins every
 * referral of the clinic. Each row prints its letter.
 */
export function ReferralsPage({ search }: { search: ReferralsSearch }) {
	const navigate = useNavigate();
	const { clinicId } = useSchedulingClinic();
	const { isAdmin } = usePermissions();
	const tab: ReferralsTab = search.box === 'clinic' && !isAdmin ? 'inbox' : (search.box ?? 'inbox');
	const [answering, setAnswering] = useState<{ referral: ReferralListFieldsFragment; answer: ReferralAnswer } | null>(
		null,
	);
	const referrals = useQuery(
		referralApi.list.queryOptions(
			{ box: BOX[tab], clinicId: tab === 'clinic' ? clinicId : null },
			{ enabled: tab !== 'clinic' || Boolean(clinicId) },
		),
	);
	const rows = referrals.data ?? [];
	const pending = rows.filter((row) => row.status === 'SENT' || row.status === 'ACCEPTED').length;
	const tabs = [
		{ id: 'inbox' as const, label: 'Inbox', icon: <Inbox /> },
		{ id: 'outbox' as const, label: 'Sent', icon: <Send /> },
		...(isAdmin ? [{ id: 'clinic' as const, label: 'Whole clinic' }] : []),
	];

	return (
		<div className={pageStyles.page}>
			<PageHeader
				title='Referrals'
				subtitle='Referrals sent to you by colleagues, and the ones you sent. Answer, mark and print them here.'
			/>
			<div>
				<TabBar
					tabs={tabs}
					activeTab={tab}
					idBase='referrals'
					onTabChange={(next) =>
						void navigate({ to: '/referrals', search: { box: next === 'inbox' ? undefined : next } })
					}
				/>
				<TabPanel idBase='referrals' tabId={tab}>
					{referrals.isPending ? (
						<Skeleton />
					) : referrals.error ? (
						<ErrorMessage message={referrals.error.message} />
					) : (
						<PageSection
							title={tab === 'inbox' ? 'Sent to you' : tab === 'outbox' ? 'Sent by you' : 'The clinic'}
							meta={pending > 0 ? `${rows.length} · ${pending} open` : String(rows.length)}
						>
							{rows.length === 0 ? (
								<EmptyState icon={Inbox} title='No referrals'>
									{tab === 'inbox'
										? 'Referrals colleagues send you show here to accept, decline and complete.'
										: 'Referrals written from a visit show here.'}
								</EmptyState>
							) : (
								<ReferralTable
									rows={rows}
									tab={tab}
									onAnswer={(referral, answer) => setAnswering({ referral, answer })}
								/>
							)}
						</PageSection>
					)}
				</TabPanel>
			</div>
			{answering && (
				<ReferralResponseDialog
					key={`${answering.referral.id}-${answering.answer}`}
					referral={answering.referral}
					answer={answering.answer}
					onClose={() => setAnswering(null)}
				/>
			)}
		</div>
	);
}

function ReferralTable({
	rows,
	tab,
	onAnswer,
}: {
	rows: ReferralListFieldsFragment[];
	tab: ReferralsTab;
	onAnswer: (referral: ReferralListFieldsFragment, answer: ReferralAnswer) => void;
}) {
	return (
		<div className={pageStyles.tableScroll}>
			<table className={pageStyles.table} data-reflow data-testid='referral-list'>
				<caption className='sr-only'>Referrals</caption>
				<thead>
					<tr>
						<th scope='col'>Referred</th>
						<th scope='col'>Patient</th>
						<th scope='col'>{tab === 'inbox' ? 'From' : 'To'}</th>
						<th scope='col'>Reason</th>
						<th scope='col'>Status</th>
						<th scope='col'>
							<span className='sr-only'>Actions</span>
						</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((referral) => (
						<tr key={referral.id} data-testid='referral-row' data-referral-id={referral.id}>
							<td data-label='Referred' className={styles.nowrap}>
								<div className={styles.stack}>
									<span>{formatDate(referral.referredAt)}</span>
									{referral.urgency !== 'ROUTINE' && (
										<ClinicalFlag tone='critical'>
											{URGENCY_LABELS[referral.urgency] ?? referral.urgency}
										</ClinicalFlag>
									)}
								</div>
							</td>
							<td data-label='Patient'>
								<div className={styles.stack}>
									<Link
										to='/patients/$patientId'
										params={{ patientId: referral.patientId }}
										className={styles.main}
									>
										{referral.patientName}
									</Link>
									<span className={styles.muted}>
										{referral.patientNo} · {referral.encounterNo}
									</span>
								</div>
							</td>
							<td data-label={tab === 'inbox' ? 'From' : 'To'}>
								<div className={styles.stack}>
									<span>
										{tab === 'inbox'
											? (referral.fromPractitioner?.displayName ?? 'A colleague')
											: referralTarget(referral)}
									</span>
									{referral.specialty && <span className={styles.muted}>{referral.specialty}</span>}
								</div>
							</td>
							<td data-label='Reason'>
								<div className={styles.stack}>
									<span>{referral.reason}</span>
									{referral.responseNotes && (
										<span className={styles.muted}>Answer: {referral.responseNotes}</span>
									)}
								</div>
							</td>
							<td data-label='Status'>
								<ClinicalFlag tone={REFERRAL_STATUS[referral.status].tone}>
									{REFERRAL_STATUS[referral.status].label}
								</ClinicalFlag>
							</td>
							<td data-label='Actions' className={styles.actions}>
								<div className={styles.actionGroup}>
									<ReferralActions referral={referral} tab={tab} onAnswer={onAnswer} />
									<Button size='sm' variant='outline' asChild>
										<Link
											to='/print/referral/$referralId'
											params={{ referralId: referral.id }}
											target='_blank'
										>
											<Printer />
											Letter
										</Link>
									</Button>
								</div>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/**
 * The answers the user may give from this box: the recipient answers an internal referral in their inbox; the
 * referring side marks an outside one from the sent box.
 */
function ReferralActions({
	referral,
	tab,
	onAnswer,
}: {
	referral: ReferralListFieldsFragment;
	tab: ReferralsTab;
	onAnswer: (referral: ReferralListFieldsFragment, answer: ReferralAnswer) => void;
}) {
	const answers = (tab === 'inbox' && referral.isInternal) || (tab === 'outbox' && !referral.isInternal);
	if (!answers) {
		return null;
	}
	const name = referral.patientName;
	if (referral.status === 'SENT') {
		return (
			<>
				<Button
					size='sm'
					onClick={() => onAnswer(referral, 'accept')}
					aria-label={`Accept referral of ${name}`}
				>
					Accept
				</Button>
				<Button
					size='sm'
					variant='outline'
					onClick={() => onAnswer(referral, 'decline')}
					aria-label={`Decline referral of ${name}`}
				>
					Decline
				</Button>
			</>
		);
	}
	if (referral.status === 'ACCEPTED') {
		return (
			<Button
				size='sm'
				onClick={() => onAnswer(referral, 'complete')}
				aria-label={`Complete referral of ${name}`}
			>
				Complete
			</Button>
		);
	}
	return null;
}
