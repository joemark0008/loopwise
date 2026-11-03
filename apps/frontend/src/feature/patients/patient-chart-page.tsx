import { vitalFlag } from '@quarry/shared/vitals';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Activity, CalendarPlus, FlaskConical, Pill, Stethoscope } from 'lucide-react';
import { useState } from 'react';
import { NewEncounterDialog } from './new-encounter-dialog';
import { languageLabel } from './patient-format';
import styles from './patient-overview.module.css';
import chartStyles from './patient-chart.module.css';
import type { VitalFlag } from '@quarry/shared/vitals';
import type { PatientFieldsFragment, PatientOverviewFieldsFragment } from '@/graphql/generated/graphql';
import { FlaggedValue, ResultFlagChip } from '@/components/clinical/clinical-flag';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageSection } from '@/components/clinical/page-header';
import { StatusBadge, statusLabel } from '@/components/clinical/status-badge';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatDateTime, medicineName, sig } from '@/feature/encounters/encounter-format';
import { SavedDocuments } from '@/feature/reports/saved-documents';
import { encounterApi } from '@/lib/encounter-api';
import { patientApi } from '@/lib/patient-api';

type Overview = PatientOverviewFieldsFragment;

/**
 * The patient chart's overview (DESIGN.md §9): the visits, each opening its record, beside what a clinician checks
 * first (latest vitals, results, problems, medicines). The banner, allergies and Wise come from the patient layout.
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
				<div className={styles.grid}>
					<div className={styles.column}>
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
					</div>
					<div className={styles.column}>
						<LatestVitals vitals={overview.data.recentVitals} />
						<Results orders={overview.data.results} />
						<Problems problems={overview.data.problems} />
						<Medicines prescriptions={overview.data.medicines} />
						<SavedDocuments patientId={patientId} />
					</div>
				</div>
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

const SEVERITY: (VitalFlag | null)[] = [null, 'normal', 'low', 'high', 'critical_low', 'critical_high'];
const worstFlag = (a: VitalFlag | null, b: VitalFlag | null) => (SEVERITY.indexOf(a) >= SEVERITY.indexOf(b) ? a : b);

const VITAL_TILES: {
	label: string;
	value: (row: Overview['recentVitals'][number]) => string | null;
	flag?: (row: Overview['recentVitals'][number]) => ReturnType<typeof vitalFlag>;
}[] = [
	{
		label: 'BP',
		value: (row) => (row.systolicMmHg !== null ? `${row.systolicMmHg}/${row.diastolicMmHg}` : null),
		flag: (row) =>
			worstFlag(vitalFlag('systolicMmHg', row.systolicMmHg), vitalFlag('diastolicMmHg', row.diastolicMmHg)),
	},
	{
		label: 'HR',
		value: (row) => row.heartRateBpm?.toString() ?? null,
		flag: (row) => vitalFlag('heartRateBpm', row.heartRateBpm),
	},
	{
		label: 'Temp °C',
		value: (row) => row.temperatureC?.toFixed(1) ?? null,
		flag: (row) => vitalFlag('temperatureC', row.temperatureC),
	},
	{
		label: 'SpO₂ %',
		value: (row) => row.spo2Pct?.toString() ?? null,
		flag: (row) => vitalFlag('spo2Pct', row.spo2Pct),
	},
	{ label: 'BMI', value: (row) => row.bmi?.toFixed(1) ?? null },
	{
		label: 'CBG',
		value: (row) => row.bloodGlucoseMgDl?.toString() ?? null,
		flag: (row) => vitalFlag('bloodGlucoseMgDl', row.bloodGlucoseMgDl),
	},
];

function LatestVitals({ vitals }: { vitals: Overview['recentVitals'] }) {
	const latest = vitals[0];
	const systolic = vitals.map((row) => row.systolicMmHg).filter((value): value is number => value !== null);
	return (
		<PageSection title='Latest vitals' meta={latest ? formatDateTime(latest.recordedAt) : undefined}>
			{!latest ? (
				<EmptyState icon={Activity} title='No vitals yet'>
					Record them on an encounter.
				</EmptyState>
			) : (
				<div className={styles.vitals}>
					{VITAL_TILES.map((tile) => {
						const value = tile.value(latest);
						if (value === null) {
							return null;
						}
						return (
							<div key={tile.label} className={styles.vital}>
								<span className={styles.vitalLabel}>{tile.label}</span>
								<span className={styles.vitalValue}>
									<FlaggedValue flag={tile.flag?.(latest)}>{value}</FlaggedValue>
								</span>
								{tile.label === 'BP' && systolic.length > 1 && (
									<Trend values={[...systolic].reverse()} />
								)}
							</div>
						);
					})}
				</div>
			)}
		</PageSection>
	);
}

/** A tiny line of the last readings, oldest to newest; the numbers stay in the record's vitals table. */
function Trend({ values }: { values: number[] }) {
	const min = Math.min(...values);
	const span = Math.max(...values) - min || 1;
	const points = values.map(
		(value, index) => `${(index / (values.length - 1)) * 60},${16 - ((value - min) / span) * 14}`,
	);
	return (
		<svg
			className={styles.spark}
			viewBox='0 0 60 18'
			preserveAspectRatio='none'
			role='img'
			aria-label={`Systolic trend: ${values.join(', ')}`}
		>
			<polyline points={points.join(' ')} fill='none' stroke='currentColor' strokeWidth='1.5' />
		</svg>
	);
}

function Results({ orders }: { orders: Overview['results'] }) {
	const toReview = orders.filter((order) => order.status === 'resulted').length;
	return (
		<PageSection title='Results' meta={toReview > 0 ? `${toReview} to review` : undefined}>
			{orders.length === 0 ? (
				<EmptyState icon={FlaskConical} title='No results yet'>
					Results of tests ordered from a visit show here with their flags.
				</EmptyState>
			) : (
				<ul className={styles.rows}>
					{orders.flatMap((order) =>
						order.results.map((result) => (
							<li key={result.id}>
								<span>
									{result.display ?? order.display ?? order.code}{' '}
									<FlaggedValue flag={result.flag}>
										<strong>
											{result.value}
											{result.unit && ` ${result.unit}`}
										</strong>
									</FlaggedValue>
									{result.refRange && <span className={styles.muted}> (ref {result.refRange})</span>}
								</span>
								{result.flag && <ResultFlagChip flag={result.flag} />}
							</li>
						)),
					)}
				</ul>
			)}
		</PageSection>
	);
}

function Problems({ problems }: { problems: Overview['problems'] }) {
	return (
		<PageSection title='Problems'>
			{problems.length === 0 ? (
				<p className={styles.muted}>No diagnoses recorded.</p>
			) : (
				<ul className={styles.rows}>
					{problems.map((problem) => (
						<li key={problem.id}>
							<span>
								<span className={styles.code}>{problem.icd10Code}</span> {problem.display}
							</span>
							{problem.certainty === 'provisional' && <span className={styles.muted}>Provisional</span>}
						</li>
					))}
				</ul>
			)}
		</PageSection>
	);
}

function Medicines({ prescriptions }: { prescriptions: Overview['medicines'] }) {
	return (
		<PageSection title='Medicines'>
			{prescriptions.length === 0 ? (
				<EmptyState icon={Pill} title='No prescriptions yet' />
			) : (
				<ul className={styles.rows}>
					{prescriptions.flatMap((prescription) =>
						prescription.items.map((item) => (
							<li key={item.id}>
								<span>
									<strong>{medicineName(item)}</strong>
									<span className={styles.muted}> · {sig(item)}</span>
								</span>
								<StatusBadge status={prescription.status} />
							</li>
						)),
					)}
				</ul>
			)}
		</PageSection>
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
