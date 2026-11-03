import { SKILL_NAME_PATTERN } from '@loopwise/shared/skill-authoring';
import { useState } from 'react';
import styles from './skills-settings.module.css';
import type { SkillDraft } from '@loopwise/shared/skill-authoring';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

/** The fields of a skill. They become one Markdown file, so nobody has to write its front matter by hand. */
export function SkillFormDialog({
	title,
	initial,
	isEditing = false,
	isPending,
	error,
	onClose,
	onSubmit,
}: {
	title: string;
	initial: SkillDraft;
	/** A skill keeps its name once it exists. */
	isEditing?: boolean;
	isPending: boolean;
	error?: string;
	onClose: () => void;
	onSubmit: (draft: SkillDraft) => void;
}) {
	const [draft, setDraft] = useState(initial);
	const nameError =
		!isEditing && draft.name && !SKILL_NAME_PATTERN.test(draft.name)
			? 'Use lowercase letters, numbers and hyphens, up to 63 characters.'
			: null;
	const isComplete = Boolean(draft.name && draft.description.trim() && draft.body.trim());

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className={styles.skillDialog}>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>
				<form
					className={styles.skillForm}
					onSubmit={(event) => {
						event.preventDefault();
						onSubmit(draft);
					}}
				>
					<label className={styles.skillField}>
						<span className={styles.skillLabel}>Name</span>
						<Input
							value={draft.name}
							onChange={(event) => setDraft({ ...draft, name: event.target.value })}
							placeholder='churn-analysis'
							className={styles.skillMono}
							disabled={isEditing}
							aria-invalid={Boolean(nameError)}
							autoFocus={!isEditing}
						/>
						<span className={styles.skillHint}>{nameError ?? 'People start it with / and this name.'}</span>
					</label>
					<label className={styles.skillField}>
						<span className={styles.skillLabel}>Description</span>
						<Textarea
							value={draft.description}
							onChange={(event) => setDraft({ ...draft, description: event.target.value })}
							placeholder='Use when the user asks about churn, retention or lost customers.'
							rows={2}
						/>
						<span className={styles.skillHint}>
							This decides when the agent uses the skill, so say which questions it covers.
						</span>
					</label>
					<label className={styles.skillField}>
						<span className={styles.skillLabel}>Instructions</span>
						<Textarea
							value={draft.body}
							onChange={(event) => setDraft({ ...draft, body: event.target.value })}
							placeholder={'1. Call qt_monthly_churn first.\n2. Exclude trial users.'}
							rows={10}
							className={styles.skillMono}
						/>
						<span className={styles.skillHint}>Markdown. Name saved query tools as qt_name.</span>
					</label>
					{error && <ErrorMessage message={error} />}
					<div className={styles.skillActions}>
						<Button type='button' variant='ghost-muted' size='sm' onClick={onClose}>
							Cancel
						</Button>
						<Button type='submit' size='sm' disabled={!isComplete || Boolean(nameError) || isPending}>
							Save skill
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
