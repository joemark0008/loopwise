import { useQuery } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import { ResultsTable } from './results-table';
import styles from './results.module.css';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageSection } from '@/components/clinical/page-header';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { resultApi } from '@/lib/result-api';

/** The chart's Results tab: every released result of the patient you can see, newest first, reviewed or not. */
export function PatientResultsSection({ patientId }: { patientId: string }) {
	const results = useQuery(resultApi.result.forPatient.queryOptions({ patientId }));
	const waiting = results.data?.filter((result) => !result.reviewedAt).length ?? 0;
	return (
		<PageSection
			title='Results'
			meta={results.data ? `${results.data.length}${waiting ? `, ${waiting} awaiting review` : ''}` : undefined}
		>
			{results.isPending ? (
				<Skeleton className={styles.skeleton} />
			) : results.error ? (
				<div>
					<ErrorMessage message={results.error.message} />
					<Button variant='outline' size='sm' onClick={() => void results.refetch()}>
						Retry
					</Button>
				</div>
			) : results.data.length === 0 ? (
				<EmptyState icon={FlaskConical} title='No results yet'>
					Lab and imaging results for this patient appear here once the clinic's lab releases them.
				</EmptyState>
			) : (
				<ResultsTable results={results.data} caption="The patient's results, newest first" />
			)}
		</PageSection>
	);
}
