import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { CalendarPlus, Stethoscope } from 'lucide-react';
import { useState } from 'react';
import { ENCOUNTER_TYPE_LABELS } from '@loopwise/shared/encounter';
import { NewEncounterDialog } from './new-encounter-dialog';
import { languageLabel } from './patient-format';
import styles from './patient-overview.module.css';
import chartStyles from './patient-chart.module.css';
import type { PatientFieldsFragment, PatientOverviewFieldsFragment } from '@/graphql/generated/graphql';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageSection } from '@/components/clinical/page-header';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/feature/encounters/encounter-format';
import { EncounterStatusBadge } from '@/feature/encounters/encounter-status-badge';
import { encounterApi } from '@/lib/encounter-api';
import { patientApi } from '@/lib/patient-api';

type Overview = PatientOverviewFieldsFragment;

/**
 * The patient chart's overview (DESIGN.md §7): the visits, each opening its record, where its vitals, results,
 * diagnoses and medicines live. The banner, allergies and Wise come from the patient layout.
 */
export function PatientChartPage({ patientId }: { patientId: string }) {
	const patient = useQuery(patientApi.patient.get.queryOptions({ id: patientId }));
	const clinics = useQuery(patientApi.patient.clinics.queryOptions());
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
				clinics={clinics.data ?? []}
				open={isNewEncounterOpen}
				onOpenChange={setIsNewEncounterOpen}
			/>
		</div>
	);
}

/** A visit row names at most this many diagnoses per line; the record has them all. */
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
			{visits.map(({ encounter, diagnoses }) => {
				const codes = unique(diagnoses, (diagnosis) => diagnosis.icd10Code ?? diagnosis.description);
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
									<span>
										<span className={styles.code}>{encounter.encounterNo}</span> ·{' '}
										{ENCOUNTER_TYPE_LABELS[encounter.type]}
									</span>
									{encounter.notes && <span className={styles.visitNotes}>{encounter.notes}</span>}
									{codes.length > 0 && (
										<span>
											{codes.slice(0, LINE_ITEMS).map((diagnosis, index) => (
												<span key={diagnosis.id}>
													{index > 0 && ' · '}
													{diagnosis.icd10Code && (
														<span className={styles.code}>{diagnosis.icd10Code}</span>
													)}{' '}
													{diagnosis.description}
												</span>
											))}
											{more(codes)}
										</span>
									)}
									<span>
										{encounter.clinic?.name}
										{encounter.practitioner && ` · ${encounter.practitioner.displayName}`}
									</span>
								</span>
							</span>
							<EncounterStatusBadge status={encounter.status} />
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
					<dt>Patient no.</dt>
					<dd>{patient.patientNo}</dd>
					<dt>Mobile number</dt>
					<dd>{patient.phone ?? '—'}</dd>
					<dt>Address</dt>
					<dd>{addressOf(patient) || '—'}</dd>
					<dt>Preferred language</dt>
					<dd>{languageLabel(patient.preferredLanguage)}</dd>
					<dt>Data privacy consent</dt>
					<dd>{patient.consentAt ? `Signed ${formatDate(patient.consentAt)}` : 'Not on file'}</dd>
					{patient.identifications.map((identification) => (
						<div key={identification.id} className={chartStyles.chartDetailRow}>
							<dt>{identification.label}</dt>
							<dd>{identification.idNumber}</dd>
						</div>
					))}
				</dl>
			</div>
		</details>
	);
}

/** `Purok 3, Cogon, Tagbilaran City` */
const addressOf = (patient: PatientFieldsFragment) =>
	[patient.address?.addressLine, patient.address?.barangayName, patient.address?.cityMunicipalityName]
		.filter(Boolean)
		.join(', ');
