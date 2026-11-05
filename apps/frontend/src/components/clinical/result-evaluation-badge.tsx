import { ArrowRight, OctagonAlert, TriangleAlert } from 'lucide-react';
import { ClinicalFlag } from './clinical-flag';
import styles from './clinical.module.css';
import type { ClinicalTone } from './clinical-flag';
import type { ResultClassification, ResultEvaluationFieldsFragment, Urgency } from '@/graphql/generated/graphql';
import { caseStateLabel, urgencyLabel } from '@/feature/pathways/pathway-format';

const CLASSIFICATION: Record<ResultClassification, { tone: ClinicalTone; label: string }> = {
	critical: { tone: 'critical', label: 'Critical' },
	actionable: { tone: 'abnormal', label: 'Actionable' },
	normal: { tone: 'normal', label: 'Normal' },
};

/** The classification and urgency of a rule evaluation as one chip: "Critical", "Actionable · urgent", "Normal". */
export function evaluationChipLabel(classification: ResultClassification, urgency: Urgency): string {
	const { label } = CLASSIFICATION[classification];
	return classification === 'actionable' ? `${label} · ${urgencyLabel(urgency).toLowerCase()}` : label;
}

/**
 * Why a result is normal, actionable or critical: the deterministic rules engine's evaluation (DESIGN.md §4.2), as a
 * chip with the rule in its title, or with `detail` the reason, the next step and the guideline under it. Meant for
 * the results inbox and the patient's results; an evaluation the engine couldn't classify says "Review by hand".
 */
export function ResultEvaluationBadge({
	evaluation,
	detail = false,
}: {
	evaluation: Pick<
		ResultEvaluationFieldsFragment,
		'classification' | 'urgency' | 'reason' | 'guideline' | 'nextState' | 'basis' | 'pathwayName' | 'ruleVersion'
	> & { rule: Pick<ResultEvaluationFieldsFragment['rule'], 'band'> };
	detail?: boolean;
}) {
	const { tone } = CLASSIFICATION[evaluation.classification];
	const unrecognised = evaluation.basis === 'unrecognised';
	const label = unrecognised ? 'Review by hand' : evaluationChipLabel(evaluation.classification, evaluation.urgency);
	const rule = `${evaluation.pathwayName} rules v${evaluation.ruleVersion}${evaluation.rule.band ? `, ${evaluation.rule.band}` : ''}`;
	const chip = (
		<ClinicalFlag
			tone={tone}
			icon={
				unrecognised || evaluation.basis === 'critical_flag'
					? TriangleAlert
					: tone === 'critical'
						? OctagonAlert
						: undefined
			}
			title={detail ? undefined : `${evaluation.reason} (${rule}; ${evaluation.guideline})`}
		>
			{label}
		</ClinicalFlag>
	);
	if (!detail) {
		return chip;
	}
	return (
		<div className={styles.evaluation} data-testid='result-evaluation'>
			<div className={styles.chipRow}>
				{chip}
				<span className={styles.evaluationNext}>
					<ArrowRight aria-hidden />
					Next: {caseStateLabel(evaluation.nextState)}
				</span>
			</div>
			<p className={styles.evaluationReason}>{evaluation.reason}</p>
			<p className={styles.evaluationSource}>
				{rule} · {evaluation.guideline}
			</p>
		</div>
	);
}
