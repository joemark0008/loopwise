import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { CircleCheck, Search, SearchX, UserPlus, Users, X } from 'lucide-react';
import { useState } from 'react';
import { ageLabel, identificationNumbers, languageLabel, patientInitials, patientName } from './patient-format';
import styles from './patient-list.module.css';
import type { PatientFieldsFragment } from '@/graphql/generated/graphql';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import pageStyles from '@/components/clinical/page.module.css';
import { EmptyState } from '@/components/clinical/empty-state';
import { formatDate, formatDay } from '@/feature/encounters/encounter-format';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { patientApi } from '@/lib/patient-api';

const SKELETON_ROWS = 8;

/** The patients the clinician may see (row-level security), searchable by name or identifier. Fills the content area. */
export function PatientListPage() {
	const [search, setSearch] = useState('');
	const query = useDebouncedValue(search.trim(), 250);
	const patients = useQuery(
		patientApi.patient.search.queryOptions({ query: query || null }, { placeholderData: keepPreviousData }),
	);
	// Hidden while the previous search's rows stand in, so it never pairs old rows with the new query.
	const count = patients.isPlaceholderData ? undefined : patients.data?.length;

	return (
		<div className={styles.listPage}>
			<header className={styles.listHeader}>
				<div className={styles.listHeading}>
					<h1 className={pageStyles.title}>Patients</h1>
					<p className={pageStyles.subtitle}>The patients in your care.</p>
				</div>
				<Button asChild>
					<Link to='/patients/new'>
						<UserPlus />
						Register patient
					</Link>
				</Button>
			</header>

			<div className={styles.listToolbar}>
				<div className={styles.listSearch} role='search'>
					<Search className={styles.listSearchIcon} aria-hidden />
					<Input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						onKeyDown={(event) => event.key === 'Escape' && setSearch('')}
						placeholder='Search by name, patient no. or PhilHealth number'
						aria-label='Search patients'
					/>
					{search && (
						<button
							type='button'
							className={styles.listSearchClear}
							onClick={() => setSearch('')}
							aria-label='Clear search'
						>
							<X aria-hidden />
						</button>
					)}
				</div>
				{count !== undefined && !patients.error && (
					<p className={styles.listCount} aria-live='polite'>
						{count === 1 ? '1 patient' : `${count} patients`}
						{query ? ` matching “${query}”` : ''}
					</p>
				)}
			</div>

			<div className={styles.listCard} aria-busy={patients.isFetching}>
				{patients.isPending ? (
					<ListSkeleton />
				) : patients.error ? (
					<div className={styles.listState}>
						<ErrorMessage message={patients.error.message} />
						<Button variant='outline' size='sm' onClick={() => void patients.refetch()}>
							Retry
						</Button>
					</div>
				) : patients.data.length === 0 ? (
					<div className={styles.listState}>
						{query ? (
							<EmptyState
								icon={SearchX}
								title='No matching patient'
								action={
									<Button variant='outline' size='sm' onClick={() => setSearch('')}>
										Clear search
									</Button>
								}
							>
								No patient in your care matches “{query}”. Check the spelling or the identifier, or{' '}
								<Link to='/patients/new' className={styles.listInlineLink}>
									register a new patient
								</Link>
								.
							</EmptyState>
						) : (
							<EmptyState icon={Users} title='No patients in your care yet'>
								Patients appear here once you have a care relationship with them.{' '}
								<Link to='/patients/new' className={styles.listInlineLink}>
									Register a patient
								</Link>
							</EmptyState>
						)}
					</div>
				) : (
					<table className={`${pageStyles.table} ${styles.listTable}`} data-testid='patient-list' data-reflow>
						<caption className='sr-only'>
							{query ? `Patients matching “${query}”` : 'Patients in your care'}
						</caption>
						<thead>
							<tr>
								<th scope='col'>Patient</th>
								<th scope='col'>Age / sex</th>
								<th scope='col'>Born</th>
								<th scope='col'>PhilHealth</th>
								<th scope='col' data-col='phone'>
									Phone
								</th>
								<th scope='col' data-col='barangay'>
									Barangay
								</th>
								<th scope='col' data-col='language'>
									Language
								</th>
								<th scope='col' data-col='consent'>
									Consent
								</th>
								<th scope='col' data-col='registered'>
									Registered
								</th>
							</tr>
						</thead>
						<tbody>
							{patients.data.map((patient) => (
								<PatientRow key={patient.id} patient={patient} />
							))}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);
}

/** One patient. The name link stretches over the row, so the whole row opens the chart with one tab stop. */
function PatientRow({ patient }: { patient: PatientFieldsFragment }) {
	const philHealth = identificationNumbers(patient, 'PHILHEALTH_ID');
	return (
		<tr className={styles.listRow}>
			<td data-label='Patient' className={styles.listPatientCell}>
				<div className={styles.listPatient}>
					<span className={styles.listAvatar} aria-hidden>
						{patientInitials(patient)}
					</span>
					<div className={styles.listPatientText}>
						<Link to='/patients/$patientId' params={{ patientId: patient.id }} className={styles.listName}>
							{patientName(patient)}
						</Link>
						<span className={styles.listMrn}>{patient.patientNo}</span>
					</div>
				</div>
			</td>
			<td data-label='Age / sex' className={styles.listNowrap}>
				{ageLabel(patient.birthDate, patient.sex)}
			</td>
			<td data-label='Born' className={styles.listNowrap}>
				{formatDay(patient.birthDate)}
			</td>
			<td data-label='PhilHealth'>
				{philHealth.length > 0 ? (
					<span className={styles.listMono}>{philHealth.join(', ')}</span>
				) : (
					<span className={styles.listNone}>None</span>
				)}
			</td>
			<td data-label='Phone' data-col='phone' className={styles.listNowrap}>
				{patient.phone ?? <span className={styles.listNone}>None</span>}
			</td>
			<td data-label='Barangay' data-col='barangay'>
				{patient.barangay ?? <span className={styles.listNone}>Not recorded</span>}
			</td>
			<td data-label='Language' data-col='language'>
				{languageLabel(patient.preferredLanguage)}
			</td>
			<td data-label='Consent' data-col='consent' className={styles.listNowrap}>
				{patient.consentAt ? (
					<span className={styles.listConsent}>
						<CircleCheck aria-hidden />
						Recorded
					</span>
				) : (
					<span className={styles.listNone}>Not recorded</span>
				)}
			</td>
			<td data-label='Registered' data-col='registered' className={styles.listNowrap}>
				{formatDate(patient.createdAt)}
			</td>
		</tr>
	);
}

/** The table's shape while the first page loads. */
function ListSkeleton() {
	return (
		<div className={styles.listSkeleton} role='status'>
			<span className='sr-only'>Loading patients</span>
			<div className={styles.listSkeletonHead} aria-hidden>
				<Skeleton className={styles.listSkeletonBar} />
			</div>
			{Array.from({ length: SKELETON_ROWS }, (_, index) => (
				<div key={index} className={styles.listSkeletonRow} aria-hidden>
					<Skeleton className={styles.listSkeletonAvatar} />
					<div className={styles.listSkeletonText}>
						<Skeleton className={styles.listSkeletonName} />
						<Skeleton className={styles.listSkeletonMeta} />
					</div>
					<Skeleton className={styles.listSkeletonCell} />
					<Skeleton className={styles.listSkeletonCell} />
					<Skeleton className={styles.listSkeletonCell} data-col='wide' />
				</div>
			))}
		</div>
	);
}
