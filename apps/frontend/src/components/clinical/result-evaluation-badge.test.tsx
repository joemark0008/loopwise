// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { evaluationChipLabel, ResultEvaluationBadge } from './result-evaluation-badge';
import { slaLabel } from '@/feature/pathways/pathway-format';

afterEach(cleanup);

const evaluation = {
	classification: 'actionable' as const,
	urgency: 'soon' as const,
	reason: 'HbA1c ≥ 6.5 %: diabetes range. Confirm with a repeat test (ADA: two abnormal results).',
	guideline: 'ADA Standards of Care in Diabetes 2025, §2',
	nextState: 'confirming' as const,
	basis: 'band',
	pathwayName: 'Diabetes (HbA1c / fasting glucose)',
	ruleVersion: 2,
	rule: { band: '6.5 – < 10 %' },
};

describe('ResultEvaluationBadge', () => {
	it('shows the classification in words, with the rule in its title', () => {
		render(<ResultEvaluationBadge evaluation={evaluation} />);
		const chip = screen.getByText('Actionable · soon');
		expect(chip.getAttribute('data-tone')).toBe('abnormal');
		expect(chip.getAttribute('title')).toBe(
			`${evaluation.reason} (Diabetes (HbA1c / fasting glucose) rules v2, 6.5 – < 10 %; ${evaluation.guideline})`,
		);
	});

	it('explains the reason, the next step and the guideline in detail', () => {
		render(<ResultEvaluationBadge evaluation={evaluation} detail />);
		const box = screen.getByTestId('result-evaluation');
		expect(box.textContent).toContain('Next: Confirming');
		expect(box.textContent).toContain(evaluation.reason);
		expect(box.textContent).toContain('rules v2, 6.5 – < 10 % · ADA Standards of Care');
	});

	it('marks a critical value critical and an unreadable result for review by hand', () => {
		render(
			<ResultEvaluationBadge
				evaluation={{ ...evaluation, classification: 'critical', urgency: 'critical', nextState: 'escalated' }}
			/>,
		);
		expect(screen.getByText('Critical').getAttribute('data-tone')).toBe('critical');
		cleanup();
		render(<ResultEvaluationBadge evaluation={{ ...evaluation, basis: 'unrecognised', rule: { band: null } }} />);
		expect(screen.getByText('Review by hand')).toBeTruthy();
	});
});

describe('labels', () => {
	it('words chips and SLAs', () => {
		expect(evaluationChipLabel('normal', 'routine')).toBe('Normal');
		expect(evaluationChipLabel('actionable', 'urgent')).toBe('Actionable · urgent');
		expect(slaLabel(1)).toBe('1 h');
		expect(slaLabel(48)).toBe('48 h');
		expect(slaLabel(336)).toBe('14 days');
		expect(slaLabel(null)).toBe('—');
	});
});
