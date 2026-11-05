import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Check, Copy, Pencil, X } from 'lucide-react';
import { memo, useState } from 'react';
import { findAnswerForToolCall } from './clarification';
import styles from './propose-skill.module.css';
import type { SkillDraft } from '@loopwise/shared/skill-authoring';
import type { ToolCallComponentProps } from '.';

import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAgentContext, useAgentMessagesSelector } from '@/contexts/agent.provider';
import { usePermissions } from '@/hooks/use-permissions';
import { skillApi } from '@/lib/skill-api';

const toMarkdown = ({ name, description, body }: SkillDraft) =>
	`---\nname: ${name}\ndescription: ${JSON.stringify(description)}\n---\n\n${body}\n`;

/** A skill the agent drafted: the person reads all of it, may change it, and only they can save it. */
export const ProposeSkillToolCall = memo(({ toolPart }: ToolCallComponentProps<'propose_skill'>) => {
	const { name, description, body } = toolPart.input ?? {};
	if (!name || !description || !body) {
		return toolPart.state === 'input-streaming' ? <Skeleton className={styles.proposeSkillSkeleton} /> : null;
	}
	return (
		<SkillDraftCard
			toolCallId={toolPart.toolCallId}
			proposed={{ name, description, body }}
			isDraftReady={toolPart.state === 'output-available'}
			error={toolPart.state === 'output-error' ? toolPart.errorText : undefined}
		/>
	);
});

function SkillDraftCard({
	toolCallId,
	proposed,
	isDraftReady,
	error,
}: {
	toolCallId: string;
	proposed: SkillDraft;
	isDraftReady: boolean;
	error?: string;
}) {
	const queryClient = useQueryClient();
	const { queueOrSendMessage, isRunning } = useAgentContext();
	const { isAdmin, isContextAdmin } = usePermissions();
	const canManage = isAdmin || isContextAdmin;
	const status = useQuery({ ...skillApi.skill.saveStatus.queryOptions(), enabled: canManage });
	const answer = useAgentMessagesSelector((messages) => findAnswerForToolCall(messages, toolCallId));
	// The agent's draft keeps growing while it streams, so only the person's own edits are held here.
	const [edited, setEdited] = useState<SkillDraft | null>(null);
	const draft = edited ?? proposed;
	const [isEditing, setIsEditing] = useState(false);
	const [isCopied, setIsCopied] = useState(false);
	const createMutation = useMutation(
		skillApi.skill.create.mutationOptions({
			onSuccess: () =>
				Promise.all(
					[skillApi.skill.list, skillApi.skill.catalog].map((procedure) =>
						queryClient.invalidateQueries({ queryKey: procedure.queryKey() }),
					),
				),
		}),
	);

	const canSave = canManage && status.data?.mode === 'direct';
	const save = () =>
		createMutation.mutate(draft, {
			onSuccess: (created) => {
				void queueOrSendMessage({ text: `I saved the skill "${created.name}".` });
			},
		});

	if (answer !== null) {
		return (
			<div className={styles.proposeSkillResolved} data-testid='propose-skill'>
				<BookOpen />
				<span className={styles.proposeSkillName}>/{draft.name}</span>
				<span>{createMutation.isSuccess || answer.startsWith('I saved') ? 'Saved' : 'Not saved'}</span>
			</div>
		);
	}
	if (error) {
		return <ErrorMessage message={error} />;
	}

	return (
		<div className={styles.proposeSkillCard} data-testid='propose-skill'>
			<div className={styles.proposeSkillHeader}>
				<BookOpen />
				<span>Skill draft</span>
			</div>
			{isEditing ? (
				<div className={styles.proposeSkillFields}>
					<Input
						value={draft.name}
						onChange={(event) => setEdited({ ...draft, name: event.target.value })}
						aria-label='Skill name'
						className={styles.proposeSkillMono}
					/>
					<Textarea
						value={draft.description}
						onChange={(event) => setEdited({ ...draft, description: event.target.value })}
						aria-label='Skill description'
						rows={2}
					/>
					<Textarea
						value={draft.body}
						onChange={(event) => setEdited({ ...draft, body: event.target.value })}
						aria-label='Skill instructions'
						rows={10}
						className={styles.proposeSkillMono}
					/>
				</div>
			) : (
				<>
					<span className={styles.proposeSkillName}>/{draft.name}</span>
					<p className={styles.proposeSkillDescription}>{draft.description}</p>
					<pre className={styles.proposeSkillBody}>{draft.body}</pre>
				</>
			)}

			{createMutation.error && <ErrorMessage message={createMutation.error.message} />}
			{canManage && status.data?.message && <p className={styles.proposeSkillNote}>{status.data.message}</p>}
			{!canManage && (
				<p className={styles.proposeSkillNote}>Only clinic admins can save skills. Copy this to share it.</p>
			)}

			<div className={styles.proposeSkillActions}>
				{canSave ? (
					<>
						<Button
							variant='ghost-muted'
							size='sm'
							disabled={isRunning || createMutation.isPending}
							onClick={() => void queueOrSendMessage({ text: 'Discard this skill draft.' })}
						>
							<X />
							Discard
						</Button>
						<Button variant='outline' size='sm' onClick={() => setIsEditing(!isEditing)}>
							<Pencil />
							{isEditing ? 'Preview' : 'Edit'}
						</Button>
						<Button
							size='sm'
							disabled={!isDraftReady || isRunning || createMutation.isPending}
							onClick={save}
						>
							<Check />
							Save skill
						</Button>
					</>
				) : (
					<Button
						variant='outline'
						size='sm'
						onClick={() => {
							void navigator.clipboard.writeText(toMarkdown(draft));
							setIsCopied(true);
						}}
					>
						{isCopied ? <Check /> : <Copy />}
						{isCopied ? 'Copied' : 'Copy'}
					</Button>
				)}
			</div>
		</div>
	);
}
