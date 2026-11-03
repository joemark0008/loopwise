import { useQuery } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { ResultsTable } from './results-table';
import { ReviewResultDialog } from './review-result-dialog';
import styles from './results.module.css';
import type { ResultItemFieldsFragment } from '@/graphql/generated/graphql';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageHeader, PageSection } from '@/components/clinical/page-header';
import pageStyles from '@/components/clinical/page.module.css';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { resultApi } from '@/lib/result-api';

/** Results waiting for the clinician's review (DESIGN.md §4.1 steps 5–6): critical first, then abnormal. */
export function ResultsInboxPage() {
	const results = useQuery(resultApi.result.toReview.queryOptions(undefined, { refetchInterval: 30_000 }));
	const [reviewing, setReviewing] = useState<ResultItemFieldsFragment | null>(null);
	const critical = results.data?.filter((result) => result.urgency === 'critical').length ?? 0;

	return (
		<div className={pageStyles.page}>
			<PageHeader
				title='Results to review'
				subtitle='Lab and imaging results for your patients, critical first.'
			/>
			<PageSection
				title='Waiting for review'
				meta={results.data ? `${results.data.length}${critical ? `, ${critical} critical` : ''}` : undefined}
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
					<EmptyState icon={FlaskConical} title='No results waiting'>
						Results from the lab (HL7 ORU) arrive here. Critical values always come first.
					</EmptyState>
				) : (
					<ResultsTable
						results={results.data}
						caption='Results waiting for your review, critical first'
						grouped
						showPatient
						onReview={setReviewing}
					/>
				)}
			</PageSection>
			<ReviewResultDialog result={reviewing} onOpenChange={(open) => !open && setReviewing(null)} />
		</div>
	);
}
