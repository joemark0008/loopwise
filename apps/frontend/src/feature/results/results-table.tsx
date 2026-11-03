import { Link } from '@tanstack/react-router';
import { Fragment } from 'react';
import { isReport, resultValue, testName, URGENCY_LABELS } from './result-format';
import { ResultFlagCell } from './result-flag-cell';
import styles from './results.module.css';
import type { ResultItemFieldsFragment } from '@/graphql/generated/graphql';
import { FlaggedValue } from '@/components/clinical/clinical-flag';
import pageStyles from '@/components/clinical/page.module.css';
import { StatusBadge } from '@/components/clinical/status-badge';
import { formatDateTime } from '@/feature/encounters/encounter-format';
import { ageLabel, patientName } from '@/feature/patients/patient-format';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Results in a dense table: the flag in words first, then the value marked when out of range. `grouped` adds a heading
 * row per urgency (the inbox); `showPatient` adds the patient column with a link to the chart.
 */
export function ResultsTable({
	results,
	caption,
	grouped = false,
	showPatient = false,
	onReview,
}: {
	results: ResultItemFieldsFragment[];
	caption: string;
	grouped?: boolean;
	showPatient?: boolean;
	onReview?: (result: ResultItemFieldsFragment) => void;
}) {
	const columns = 4 + (showPatient ? 1 : 0) + 2 + (onReview ? 1 : 0);
	return (
		<div className={pageStyles.tableScroll}>
			<table className={pageStyles.table} data-reflow data-testid='results-table'>
				<caption className='sr-only'>{caption}</caption>
				<thead>
					<tr>
						<th scope='col'>Flag</th>
						{showPatient && <th scope='col'>Patient</th>}
						<th scope='col'>Test</th>
						<th scope='col' data-numeric>
							Result
						</th>
						<th scope='col'>Reference</th>
						<th scope='col'>From</th>
						<th scope='col'>{onReview ? 'Received' : 'Resulted'}</th>
						{onReview ? <th scope='col'>Action</th> : <th scope='col'>Status</th>}
					</tr>
				</thead>
				<tbody>
					{results.map((result, index) => (
						<Fragment key={result.id}>
							{grouped && result.urgency !== results[index - 1]?.urgency && (
								<tr>
									<th scope='colgroup' colSpan={columns} className={styles.groupHeading}>
										{URGENCY_LABELS[result.urgency]}
									</th>
								</tr>
							)}
							<tr data-testid='result-row' data-urgency={result.urgency}>
								<td data-label='Flag'>
									<ResultFlagCell result={result} />
								</td>
								{showPatient && (
									<td data-label='Patient'>
										<Link
											to='/patients/$patientId/results'
											params={{ patientId: result.patient.id }}
											className={styles.patientLink}
										>
											{patientName(result.patient)}
										</Link>{' '}
										<span className={styles.muted}>
											{ageLabel(result.patient.birthDate, result.patient.sex)}
										</span>
									</td>
								)}
								<td data-label='Test'>{testName(result)}</td>
								<td
									data-label='Result'
									data-numeric
									className={styles.nowrap}
									title={isReport(result) ? result.value : undefined}
								>
									<FlaggedValue flag={result.flag}>{resultValue(result)}</FlaggedValue>
								</td>
								<td data-label='Reference' className={cn(styles.muted, styles.nowrap)}>
									{result.refRange ?? '—'}
								</td>
								<td data-label='From'>{result.sourceFacility.name}</td>
								<td data-label={onReview ? 'Received' : 'Resulted'} className={styles.nowrap}>
									{formatDateTime(onReview ? result.receivedAt : result.resultedAt)}
								</td>
								{onReview ? (
									<td data-label='Action'>
										<Button size='sm' variant='outline' onClick={() => onReview(result)}>
											Mark reviewed
										</Button>
									</td>
								) : (
									<td data-label='Status'>
										<StatusBadge status={result.reviewedAt ? 'reviewed' : 'resulted'} />
									</td>
								)}
							</tr>
						</Fragment>
					))}
				</tbody>
			</table>
		</div>
	);
}
