import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { BillingTab } from './billing-tab';
import { CertificateTab } from './certificate-tab';
import styles from './encounter.module.css';
import { formatDateTime, vitalChips } from './encounter-format';
import { NoteTab } from './note-tab';
import { OrdersTab } from './orders-tab';
import { PrescriptionsTab } from './prescriptions-tab';
import { VitalsTab } from './vitals-tab';
import type { EncounterTab } from './encounter-tabs';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { TabBar, TabPanel } from '@/components/ui/tab-bar';
import { encounterRecordApi } from '@/lib/encounter-record-api';

const TAB_ID = 'encounter';

/**
 * One visit's record (DESIGN.md §7): the note and diagnoses, vitals, orders and results, prescriptions and medical
 * certificates and the bill, as tabs (`?tab=`), under the patient banner and beside the patient's Wise chat. Every
 * read is audited by the API; only staff at the visit's facility can add to it.
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
		{ id: 'vitals' as const, label: 'Vitals', count: activeCount(data.vitals) },
		{ id: 'orders' as const, label: 'Orders & results', count: data.orders.length },
		{ id: 'prescriptions' as const, label: 'Prescriptions', count: data.prescriptions.length },
		{ id: 'certificate' as const, label: 'Medical certificate', count: data.medicalCertificates.length },
		{
			id: 'billing' as const,
			label: 'Billing',
			count: data.bills.filter((bill) => bill.status !== 'voided').length,
		},
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
					{formatDateTime(data.encounter.startedAt)}
					{data.encounter.facility && ` · ${data.encounter.facility.name}`}
					{data.encounter.doctor && ` · ${data.encounter.doctor.name}`}
				</p>
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
						Read only: only staff at {data.encounter.facility?.name ?? 'the visit’s facility'} can add to
						this record.
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
