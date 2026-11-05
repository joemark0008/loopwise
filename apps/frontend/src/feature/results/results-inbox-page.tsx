import { useQuery } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { ResultsTable } from './results-table';
import { ReviewResultDialog } from './review-result-dialog';
import styles from './results.module.css';
import type { DiagnosticReportFieldsFragment } from '@/graphql/generated/graphql';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageHeader, PageSection } from '@/components/clinical/page-header';
import pageStyles from '@/components/clinical/page.module.css';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { resultApi } from '@/lib/result-api';

/**
 * Released lab and imaging results waiting for the doctor's review: critical first, then abnormal. Opening the inbox is
 * audited (one row per patient listed), so it refreshes on focus rather than polling.
 */
export function ResultsInboxPage() {
	const results = useQuery(resultApi.result.toReview.queryOptions(undefined));
	const [reviewing, setReviewing] = useState<DiagnosticReportFieldsFragment | null>(null);
	const critical = results.data?.filter((result) => result.urgency === 'CRITICAL').length ?? 0;

	return (
		<div className={pageStyles.page}>
			<PageHeader
				title='Results to review'
				subtitle="Results the clinic's lab released for your patients, critical first."
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
						Results the lab releases for your patients arrive here. Critical values always come first.
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
