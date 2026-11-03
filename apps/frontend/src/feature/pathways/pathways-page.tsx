import { useQuery } from '@tanstack/react-query';
import { Route as RouteIcon } from 'lucide-react';
import styles from './pathways.module.css';
import type { PathwayFieldsFragment } from '@/graphql/generated/graphql';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageHeader, PageSection } from '@/components/clinical/page-header';
import pageStyles from '@/components/clinical/page.module.css';
import { ClinicalFlag } from '@/components/clinical/clinical-flag';
import { evaluationChipLabel } from '@/components/clinical/result-evaluation-badge';
import { caseStateLabel, evidenceLabel, slaLabel } from '@/feature/pathways/pathway-format';
import { pathwayApi } from '@/lib/pathway-api';

const TONE = { critical: 'critical', actionable: 'abnormal', normal: 'normal' } as const;

/**
 * The clinical pathways, read-only (DESIGN.md §2 "rules-first decisions", §7, §8): every threshold, what it concludes
 * and why, the steps a case goes through and their SLAs. What the rules engine applies is exactly what this shows.
 */
export function PathwaysPage() {
	const pathways = useQuery(pathwayApi.pathway.list.queryOptions());
	return (
		<div className={pageStyles.page}>
			<PageHeader
				title='Clinical pathways'
				subtitle='The rules that decide whether a result is actionable and how urgent it is. Deterministic and cited; Wise explains them but never decides.'
			/>
			{pathways.isPending ? (
				<p role='status'>Loading pathways…</p>
			) : pathways.isError ? (
				<p role='alert'>The pathways could not be loaded.</p>
			) : pathways.data.length === 0 ? (
				<EmptyState icon={RouteIcon} title='No active pathways'>
					Pathways are seeded with the demo data (`npm run db:seed`).
				</EmptyState>
			) : (
				pathways.data.map((pathway) => <PathwayCard key={pathway.key} pathway={pathway} />)
			)}
		</div>
	);
}

function PathwayCard({ pathway }: { pathway: PathwayFieldsFragment }) {
	return (
		<PageSection title={pathway.name} meta={`v${pathway.version}`} labelledBy={`pathway-${pathway.key}`}>
			<div className={styles.body} data-testid={`pathway-${pathway.key}`}>
				<p className={styles.source}>Guidelines: {pathway.source}</p>
				{pathway.triggers.map((trigger) => (
					<div key={trigger.code} className={styles.trigger}>
						<h3 className={styles.heading}>
							{trigger.display} <span className={styles.code}>LOINC {trigger.code}</span>
							{trigger.unit && <span className={styles.code}>in {trigger.unit}</span>}
						</h3>
						{trigger.conversions.map((conversion) => (
							<p key={conversion.from.join()} className={styles.note}>
								{conversion.note ??
									`${conversion.from.join(', ')} × ${conversion.factor} + ${conversion.offset}`}
							</p>
						))}
						<div className={pageStyles.tableScroll}>
							<table className={pageStyles.table} data-reflow>
								<caption className='sr-only'>{trigger.display} bands</caption>
								<thead>
									<tr>
										<th scope='col'>{trigger.type === 'coded' ? 'Value' : 'Range'}</th>
										<th scope='col'>Classification</th>
										<th scope='col'>Next step</th>
										<th scope='col'>SLA</th>
										<th scope='col'>Why</th>
									</tr>
								</thead>
								<tbody>
									{trigger.bands.map((band) => (
										<tr key={band.label}>
											<td
												data-label={trigger.type === 'coded' ? 'Value' : 'Range'}
												className={styles.nowrap}
											>
												{band.label}
											</td>
											<td data-label='Classification'>
												<ClinicalFlag tone={TONE[band.classification]}>
													{evaluationChipLabel(band.classification, band.urgency)}
												</ClinicalFlag>
											</td>
											<td data-label='Next step'>{caseStateLabel(band.nextState)}</td>
											<td data-label='SLA' className={styles.nowrap}>
												{slaLabel(band.slaHours)}
											</td>
											<td data-label='Why'>
												<span>
													{band.reason}
													<span className={styles.guideline}>{band.guideline}</span>
												</span>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				))}
				<p className={styles.note}>
					A result the lab flags critical is always at least actionable and urgent; when its band says less,
					the case goes to <strong>{caseStateLabel(pathway.criticalFlagNextState).toLowerCase()}</strong>. A
					result the rules can’t read (unknown unit or value) goes to a clinician’s review, never dropped.
				</p>

				<h3 className={styles.heading}>Steps</h3>
				<ol className={styles.steps}>
					{pathway.steps.map((step) => (
						<li key={step.state}>
							<span className={styles.stepState}>{caseStateLabel(step.state)}</span>
							<span>{step.label}</span>
							<span className={styles.stepSla}>
								{step.slaHours ? `SLA ${slaLabel(step.slaHours)}` : ''}
							</span>
						</li>
					))}
				</ol>
				<p className={styles.note}>
					Results reviewed within {slaLabel(pathway.resultReviewHours)}; critical values reach a clinician
					within {slaLabel(pathway.criticalAlertHours)}. Any step can escalate or end lost to follow-up.
				</p>

				<h3 className={styles.heading}>Closing a case</h3>
				<p className={styles.note}>
					{pathway.closureDescription} Accepted evidence:{' '}
					{pathway.closureEvidence.map(evidenceLabel).join(', ')}.
				</p>
			</div>
		</PageSection>
	);
}
