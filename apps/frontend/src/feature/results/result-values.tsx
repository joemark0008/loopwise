import { valueText } from './result-format';
import styles from './results.module.css';
import type { DiagnosticReportFieldsFragment } from '@/graphql/generated/graphql';
import { FlaggedValue, ResultFlagChip } from '@/components/clinical/clinical-flag';

/**
 * A result as the lab report prints it: each analyte with its value (marked when out of range), reference range and
 * flag, or the findings and impression of an imaging report.
 */
export function ResultValues({
	result,
}: {
	result: Pick<DiagnosticReportFieldsFragment, 'values' | 'findings' | 'impression' | 'remarks'>;
}) {
	return (
		<div className={styles.resultValues} data-testid='result-values'>
			{result.values.length > 0 && (
				<table className={styles.valuesTable}>
					<thead>
						<tr>
							<th scope='col'>Analyte</th>
							<th scope='col' data-numeric>
								Result
							</th>
							<th scope='col'>Reference</th>
							<th scope='col'>Flag</th>
						</tr>
					</thead>
					<tbody>
						{result.values.map((value) => (
							<tr key={value.id} data-flag={value.flag ?? undefined}>
								<td>{value.name}</td>
								<td data-numeric>
									<FlaggedValue flag={value.flag}>{valueText(value)}</FlaggedValue>
								</td>
								<td className={styles.muted}>{value.referenceRange ?? '—'}</td>
								<td>{value.flag && <ResultFlagChip flag={value.flag} />}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
			{result.findings && <pre className={styles.report}>{result.findings}</pre>}
			{result.impression && (
				<p>
					<strong>Impression:</strong> {result.impression}
				</p>
			)}
			{result.remarks && <p className={styles.muted}>{result.remarks}</p>}
		</div>
	);
}
