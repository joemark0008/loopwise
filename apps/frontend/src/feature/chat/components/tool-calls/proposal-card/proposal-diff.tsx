import { useState } from 'react';
import styles from './proposal-card.module.css';
import type { FieldChange } from './diff-fields';
import { computeLineDiff } from '@/lib/line-diff';

/**
 * The before → after of an update card: each changed field with its old value struck and its new value marked
 * (line by line for text over several lines); the unchanged fields fold away behind a count.
 */
export function ProposalDiff({ changes }: { changes: FieldChange[] }) {
	const [showUnchanged, setShowUnchanged] = useState(false);
	const changed = changes.filter((change) => change.changed);
	const unchanged = changes.filter((change) => !change.changed);

	return (
		<div className={styles.proposalDiff} data-testid='proposal-diff'>
			{changed.length === 0 && <p className={styles.proposalDiffEmpty}>Nothing would change.</p>}
			{changed.map((change) => (
				<div key={change.key} className={styles.proposalDiffRow} data-testid={`proposal-diff-${change.key}`}>
					<span className={styles.proposalDiffLabel}>{change.label}</span>
					<ChangedValue before={change.before} after={change.after} />
				</div>
			))}
			{unchanged.length > 0 && (
				<>
					<button
						type='button'
						className={styles.proposalDiffToggle}
						onClick={() => setShowUnchanged(!showUnchanged)}
					>
						{showUnchanged ? 'Hide' : 'Show'} {unchanged.length} unchanged{' '}
						{unchanged.length === 1 ? 'field' : 'fields'}
					</button>
					{showUnchanged &&
						unchanged.map((change) => (
							<div key={change.key} className={styles.proposalDiffUnchanged}>
								<span className={styles.proposalDiffLabel}>{change.label}</span>
								<span>{change.before ?? '—'}</span>
							</div>
						))}
				</>
			)}
		</div>
	);
}

function ChangedValue({ before, after }: { before: string | null; after: string | null }) {
	const isMultiline = (before ?? '').includes('\n') || (after ?? '').includes('\n');
	if (isMultiline && before && after) {
		return (
			<div className={styles.proposalDiffLines}>
				{computeLineDiff(before, after).lines.map((line, index) => (
					<span
						key={index}
						className={
							line.type === 'add'
								? styles.proposalDiffAfter
								: line.type === 'remove'
									? styles.proposalDiffBefore
									: undefined
						}
					>
						{line.type === 'add' ? '+ ' : line.type === 'remove' ? '− ' : '  '}
						{line.text}
					</span>
				))}
			</div>
		);
	}
	return (
		<div className={styles.proposalDiffValues}>
			{before ? (
				<del className={styles.proposalDiffBefore} aria-label={`was: ${before}`}>
					{before}
				</del>
			) : (
				<span className={styles.proposalDiffNone}>empty</span>
			)}
			<span aria-hidden>→</span>
			{after ? (
				<ins className={styles.proposalDiffAfter} aria-label={`will be: ${after}`}>
					{after}
				</ins>
			) : (
				<span className={styles.proposalDiffNone}>cleared</span>
			)}
		</div>
	);
}
