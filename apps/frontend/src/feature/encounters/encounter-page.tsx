import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ENCOUNTER_TYPE_LABELS } from '@loopwise/shared/encounter';
import { ArrowLeft } from 'lucide-react';
import { BillingTab } from './billing-tab';
import { CertificateTab } from './certificate-tab';
import styles from './encounter.module.css';
import { formatDateTime, vitalChips } from './encounter-format';
import { EncounterStatusActions } from './encounter-status-actions';
import { EncounterStatusBadge } from './encounter-status-badge';
import { NoteTab } from './note-tab';
import { OrdersTab } from './orders-tab';
import { PrescriptionsTab } from './prescriptions-tab';
import { VitalsTab } from './vitals-tab';
import type { EncounterTab } from './encounter-tabs';
import { ScribePanel } from '@/feature/scribe/scribe-panel';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { TabBar, TabPanel } from '@/components/ui/tab-bar';
import { encounterRecordApi } from '@/lib/encounter-record-api';

const TAB_ID = 'encounter';

/**
 * One visit's record (DESIGN.md §5): the note and diagnoses, vitals, orders and results, prescriptions and medical
 * certificates and the bill, as tabs (`?tab=`), under the patient banner and beside the patient's Wise chat. The
 * header moves the visit along its status. Every read is audited by the API; only staff at the visit's clinic can add
 * to it.
 */
export function EncounterPage({
	patientId,
	encounterId,
	tab,
}: {
	patientId: string;
	encounterId: string;
	tab: EncounterTab;
}) {
	const navigate = useNavigate();
	const record = useQuery(encounterRecordApi.encounterRecord.get.queryOptions({ encounterId }));

	if (record.isPending) {
		return <Skeleton className={styles.recordSkeleton} />;
	}
	if (record.error) {
		return (
			<div className={styles.recordError}>
				<ErrorMessage message={record.error.message} />
				<Button variant='outline' size='sm' onClick={() => void record.refetch()}>
					Retry
				</Button>
			</div>
		);
	}
	if (!record.data || record.data.encounter.patientId !== patientId) {
		return <Empty>This encounter is not in your care, or does not exist.</Empty>;
	}

	const data = record.data;
	const latestVitals = data.vitals.find((vitals) => !vitals.voidedAt);
	const tabs = [
		{ id: 'note' as const, label: 'Note & diagnosis', count: activeCount(data.diagnoses) },
		// The AI scribe drafts into the record, so only staff who can add to it see it.
		...(data.canEdit ? [{ id: 'scribe' as const, label: 'AI scribe' }] : []),
		{ id: 'vitals' as const, label: 'Vitals', count: activeCount(data.vitals) },
		// The other areas' tabs count their own records once their fields are on the record again.
		{ id: 'orders' as const, label: 'Orders & results' },
		{ id: 'prescriptions' as const, label: 'Prescriptions' },
		{ id: 'certificate' as const, label: 'Medical certificate' },
		{ id: 'billing' as const, label: 'Billing' },
	];

	return (
		<div className={styles.record}>
			<header className={styles.encounterHeader}>
				<Link to='/patients/$patientId' params={{ patientId }} className={styles.backToChart}>
					<ArrowLeft />
					Chart
				</Link>
				<h2 className={styles.encounterTitle} data-testid='encounter-title'>
					{data.encounter.reason ?? 'Visit'}
				</h2>
				<p className={styles.encounterSubtitle}>
					<EncounterStatusBadge status={data.encounter.status} /> {data.encounter.encounterNo} ·{' '}
					{ENCOUNTER_TYPE_LABELS[data.encounter.type]} · {formatDateTime(data.encounter.startedAt)}
					{data.encounter.clinic && ` · ${data.encounter.clinic.name}`}
					{data.encounter.practitioner && ` · ${data.encounter.practitioner.displayName}`}
				</p>
				{data.canEdit && (
					<EncounterStatusActions
						encounterId={data.encounter.id}
						status={data.encounter.status}
						version={data.encounter.version}
					/>
				)}
				{latestVitals && (
					<div className={styles.chipRow} data-testid='latest-vitals'>
						<span className={styles.chipLabel}>Latest vitals</span>
						{vitalChips(latestVitals).map((chip) => (
							<span key={chip} className={styles.chip}>
								{chip}
							</span>
						))}
					</div>
				)}
				{!data.canEdit && (
					<p className={styles.muted}>
						{data.encounter.status === 'CANCELLED'
							? 'Read only: this visit was cancelled.'
							: `Read only: only staff at ${data.encounter.clinic?.name ?? 'the visit’s clinic'} can add to this record.`}
					</p>
				)}
			</header>
			<div>
				<TabBar
					tabs={tabs}
					activeTab={tab}
					idBase={TAB_ID}
					onTabChange={(next) =>
						void navigate({
							to: '/patients/$patientId/encounters/$encounterId',
							params: { patientId, encounterId },
							search: { tab: next === 'note' ? undefined : next },
							replace: true,
						})
					}
				/>
				<TabPanel idBase={TAB_ID} tabId={tab} className={styles.tabPanel}>
					{tab === 'note' && <NoteTab key={data.encounter.id} record={data} />}
					{tab === 'scribe' && data.canEdit && <ScribePanel record={data} />}
					{tab === 'vitals' && <VitalsTab record={data} />}
					{tab === 'orders' && <OrdersTab record={data} />}
					{tab === 'prescriptions' && <PrescriptionsTab record={data} />}
					{tab === 'certificate' && <CertificateTab record={data} />}
					{tab === 'billing' && <BillingTab record={data} />}
				</TabPanel>
			</div>
		</div>
	);
}

const activeCount = (rows: { voidedAt?: string | null }[]) => rows.filter((row) => !row.voidedAt).length;
