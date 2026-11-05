import { Link } from '@tanstack/react-router';
import { Fragment } from 'react';
import { referenceRange, resultSummary, URGENCY_LABELS } from './result-format';
import { ResultFlagCell } from './result-flag-cell';
import styles from './results.module.css';
import type { DiagnosticReportFieldsFragment } from '@/graphql/generated/graphql';
import { ClinicalFlag, FlaggedValue } from '@/components/clinical/clinical-flag';
import pageStyles from '@/components/clinical/page.module.css';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/feature/encounters/encounter-format';
import { ageSex, personName } from '@/feature/orders/order-format';
import { cn } from '@/lib/utils';

/**
 * Released results in a dense table: the flag in words first, then the result marked when out of range. `grouped`
 * adds a heading row per urgency (the inbox); `showPatient` adds the patient column with a link to the chart.
 */
export function ResultsTable({
	results,
	caption,
	grouped = false,
	showPatient = false,
	onReview,
}: {
	results: DiagnosticReportFieldsFragment[];
	caption: string;
	grouped?: boolean;
	showPatient?: boolean;
	onReview?: (result: DiagnosticReportFieldsFragment) => void;
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
						<th scope='col'>Requested by</th>
						<th scope='col'>Released</th>
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
											{personName(result.patient)}
										</Link>{' '}
										<span className={styles.muted}>
											{ageSex(result.patient.birthDate, result.patient.sex as 'MALE' | 'FEMALE')}
										</span>
									</td>
								)}
								<td data-label='Test'>
									{result.test.name}
									<div className={styles.muted}>{result.order.orderNo}</div>
								</td>
								<td data-label='Result' data-numeric className={styles.nowrap}>
									<FlaggedValue flag={result.values.length === 1 ? result.flag : null}>
										{resultSummary(result)}
									</FlaggedValue>
								</td>
								<td data-label='Reference' className={cn(styles.muted, styles.nowrap)}>
									{referenceRange(result) ?? '—'}
								</td>
								<td data-label='Requested by'>{result.order.requestedByName ?? '—'}</td>
								<td data-label='Released' className={styles.nowrap}>
									{result.releasedAt ? formatDateTime(result.releasedAt) : '—'}
								</td>
								{onReview ? (
									<td data-label='Action'>
										<Button size='sm' variant='outline' onClick={() => onReview(result)}>
											Mark reviewed
										</Button>
									</td>
								) : (
									<td data-label='Status'>
										{result.reviewedAt ? (
											<ClinicalFlag tone='done'>Reviewed</ClinicalFlag>
										) : (
											<ClinicalFlag tone='abnormal'>Awaiting review</ClinicalFlag>
										)}
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
