import { Link } from '@tanstack/react-router';
import { Scale } from 'lucide-react';
import { memo } from 'react';
import styles from './explain-result.module.css';
import type { explainResult } from '@quarry/shared/tools';
import type { ToolCallComponentProps } from '.';
import { ResultEvaluationBadge } from '@/components/clinical/result-evaluation-badge';
import { ErrorMessage } from '@/components/ui/error-message';

/**
 * Wise's `explain_result` (DESIGN.md §2, §9.2): the rules engine's evaluation of one result, as the pathway rule says
 * it, with a link to the pathways page. Wise relays this; it never decides.
 */
export const ExplainResultToolCall = memo(({ toolPart }: ToolCallComponentProps<'explain_result'>) => {
	if (toolPart.state === 'output-error') {
		return <ErrorMessage message={toolPart.errorText} />;
	}
	if (toolPart.state !== 'output-available' || !toolPart.output) {
		return null;
	}
	return <ResultExplanation output={toolPart.output} />;
});

export function ResultExplanation({ output }: { output: explainResult.Output }) {
	const { result, evaluation } = output;
	return (
		<div className={styles.explainResult} data-testid='explain-result'>
			<div className={styles.header}>
				<Scale aria-hidden />
				<span>
					Pathway rule for {result.display}: {result.value}
					{result.unit ? ` ${result.unit}` : ''}
				</span>
			</div>
			{evaluation ? (
				<ResultEvaluationBadge evaluation={evaluation} detail />
			) : (
				<p className={styles.none}>No pathway applies to this result; the clinician judges it.</p>
			)}
			<Link to='/pathways' className={styles.link}>
				See all pathway rules
			</Link>
		</div>
	);
}
