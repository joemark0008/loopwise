import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { CalendarPlus, Stethoscope } from 'lucide-react';
import { useState } from 'react';
import { NewEncounterDialog } from './new-encounter-dialog';
import { languageLabel } from './patient-format';
import styles from './patient-overview.module.css';
import chartStyles from './patient-chart.module.css';
import type { PatientFieldsFragment, PatientOverviewFieldsFragment } from '@/graphql/generated/graphql';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageSection } from '@/components/clinical/page-header';
import { StatusBadge, statusLabel } from '@/components/clinical/status-badge';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/feature/encounters/encounter-format';
import { encounterApi } from '@/lib/encounter-api';
import { patientApi } from '@/lib/patient-api';

type Overview = PatientOverviewFieldsFragment;

/**
 * The patient chart's overview (DESIGN.md §9): the visits, each opening its record, where its vitals, results,
 * diagnoses and medicines live. The banner, allergies and Wise come from the patient layout.
 */
export function PatientChartPage({ patientId }: { patientId: string }) {
	const patient = useQuery(patientApi.patient.get.queryOptions({ id: patientId }));
	const facilities = useQuery(patientApi.patient.facilities.queryOptions());
	const overview = useQuery(encounterApi.encounter.overview.queryOptions({ patientId }));
	const [isNewEncounterOpen, setIsNewEncounterOpen] = useState(false);

	if (!patient.data) {
		return null;
	}
	return (
		<div className={styles.overview}>
			{overview.isPending ? (
				<Skeleton className={chartStyles.chartSkeleton} />
			) : overview.error ? (
				<div className={chartStyles.chartErrorRow}>
					<ErrorMessage message={overview.error.message} />
					<Button variant='outline' size='sm' onClick={() => void overview.refetch()}>
						Retry
					</Button>
				</div>
			) : (
				<PageSection
					title='Visits'
					meta={
						<Button size='sm' onClick={() => setIsNewEncounterOpen(true)}>
							<CalendarPlus />
							New encounter
						</Button>
					}
				>
					<VisitList patientId={patientId} visits={overview.data.visits} />
				</PageSection>
			)}
			<PatientDetails patient={patient.data} />
			<NewEncounterDialog
				patientId={patientId}
				facilities={facilities.data ?? []}
				open={isNewEncounterOpen}
				onOpenChange={setIsNewEncounterOpen}
			/>
		</div>
	);
}

/** A visit row names at most this many diagnoses, medicines or tests per line; the record has them all. */
const LINE_ITEMS = 3;
const more = (items: unknown[]) => (items.length > LINE_ITEMS ? ` +${items.length - LINE_ITEMS} more` : '');
const unique = <T,>(items: T[], key: (item: T) => string) =>
	items.filter((item, index) => items.findIndex((other) => key(other) === key(item)) === index);

function VisitList({ patientId, visits }: { patientId: string; visits: Overview['visits'] }) {
	if (visits.length === 0) {
		return (
			<EmptyState icon={Stethoscope} title='No visits yet'>
				Start a new encounter, or describe the visit to Wise and confirm its draft.
			</EmptyState>
		);
	}
	return (
		<ul className={styles.visits} data-testid='encounter-list'>
			{visits.map(({ encounter, diagnoses, prescriptions, orders, billStatus }) => {
				const codes = unique(diagnoses, (diagnosis) => diagnosis.icd10Code);
				const medicines = unique(
					prescriptions.flatMap((prescription) => prescription.items),
					(item) => item.genericName,
				).map((item) => item.genericName);
				const tests = unique(orders, (order) => order.code).map(
					(order) => `${order.display ?? order.code} (${statusLabel(order.status).toLowerCase()})`,
				);
				return (
					<li key={encounter.id}>
						<Link
							to='/patients/$patientId/encounters/$encounterId'
							params={{ patientId, encounterId: encounter.id }}
							className={styles.visit}
						>
							<span className={styles.visitDate}>{formatDate(encounter.startedAt)}</span>
							<span>
								<span className={styles.visitReason}>{encounter.reason ?? 'Visit'}</span>
								<span className={styles.visitLines}>
									{encounter.notes && <span className={styles.visitNotes}>{encounter.notes}</span>}
									{codes.length > 0 && (
										<span>
											{codes.slice(0, LINE_ITEMS).map((diagnosis, index) => (
												<span key={diagnosis.id}>
													{index > 0 && ' · '}
													<span className={styles.code}>{diagnosis.icd10Code}</span>{' '}
													{diagnosis.display}
												</span>
											))}
											{more(codes)}
										</span>
									)}
									{medicines.length > 0 && (
										<span>
											Rx {medicines.slice(0, LINE_ITEMS).join(', ')}
											{more(medicines)}
										</span>
									)}
									{tests.length > 0 && (
										<span>
											Ordered {tests.slice(0, LINE_ITEMS).join(', ')}
											{more(tests)}
										</span>
									)}
									<span>
										{encounter.facility?.name}
										{encounter.doctor && ` · ${encounter.doctor.name}`}
									</span>
								</span>
							</span>
							{billStatus ? <StatusBadge status={billStatus} /> : <span />}
						</Link>
					</li>
				);
			})}
		</ul>
	);
}

function PatientDetails({ patient }: { patient: PatientFieldsFragment }) {
	return (
		<details className={styles.details}>
			<summary>Patient details</summary>
			<div className={styles.detailsBody}>
				<dl className={chartStyles.chartDetails}>
					<dt>Mobile number</dt>
					<dd>{patient.phone ?? '—'}</dd>
					<dt>Preferred language</dt>
					<dd>{languageLabel(patient.preferredLanguage)}</dd>
					<dt>Consent</dt>
					<dd>{patient.consentAt ? `Recorded ${formatDate(patient.consentAt)}` : 'Not recorded'}</dd>
					{patient.identifiers.map((identifier) => (
						<div key={`${identifier.system}-${identifier.value}`} className={chartStyles.chartDetailRow}>
							<dt>{identifier.system}</dt>
							<dd>
								{identifier.value}
								{identifier.facility && (
									<span className={chartStyles.chartMuted}> · {identifier.facility.name}</span>
								)}
							</dd>
						</div>
					))}
				</dl>
			</div>
		</details>
	);
}
