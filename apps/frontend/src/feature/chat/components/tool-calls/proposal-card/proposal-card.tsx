import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DESTRUCTIVE_REASON_MIN_LENGTH, isStaleEditMessage } from '@loopwise/shared/wise-proposal';
import { Check, Pencil, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { findAnswerForToolCall } from '../clarification';
import styles from './proposal-card.module.css';
import { ProposalDiff } from './proposal-diff';
import type { FieldChange } from './diff-fields';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Textarea } from '@/components/ui/textarea';
import { useAgentContext, useAgentMessagesSelector } from '@/contexts/agent.provider';
import { wiseProposalApi } from '@/lib/wise-proposal-api';

/** The card a confirm comes from; the mutation sends it back (`wiseOrigin`) with whether the draft was `edited`. */
export interface ProposalOrigin {
	chatId: string;
	toolCallId: string;
	toolName: string;
}

export interface ProposalConfirm {
	origin: ProposalOrigin;
	/** The reason a destructive card asks for. */
	reason?: string;
}

type Mode =
	/** A new record: the draft's fields (`children`). */
	| { mode?: 'create' }
	/** A change to an existing record: before → after of each field; unchanged fields fold away. */
	| { mode: 'update'; target: ProposalTarget; changes: FieldChange[] }
	/** Voiding or removing a record: needs a reason and a second click. */
	| { mode: 'destructive'; target: ProposalTarget };

export interface ProposalTarget {
	/** The record, e.g. "Encounter note". */
	label: string;
	/** Whose and when, e.g. "Maria Santos · 3 Nov 2026 · Health Center". */
	detail?: string;
}

/** Sent by Re-draft when the record changed after the card was drafted. */
export const REDRAFT_MESSAGE = 'The record changed since your draft. Re-draft it from the current record.';

const BADGES = {
	create: 'Draft · needs your confirmation',
	update: 'Changes an existing record · needs your confirmation',
	destructive: 'Removes a record · needs your confirmation',
};

/**
 * The card of a Wise proposal tool (DESIGN.md §7.1: AI drafts, the clinician confirms). The tool writes nothing; only
 * Confirm calls the real mutation, with the card's origin, and the API settles the card once. The card never confirms
 * by itself, and a second Confirm is dropped until the first settles.
 *
 * It is settled (one line saying how it ended, also after a reload) once the API has its outcome, once the clinician
 * has answered in the chat (Confirm and Cancel both send a message), or once this tab confirmed it.
 *
 * Modes: `create` shows the draft, `update` the before → after of an existing record, `destructive` asks for a reason
 * and a second click. A stale-record error (the record changed since the draft) locks Confirm and offers Re-draft.
 * Every Wise card that writes uses this shell.
 */
export function ProposalCard({
	toolCallId,
	toolName,
	icon: Icon,
	title,
	children,
	warnings,
	error,
	confirmLabel,
	onConfirm,
	isConfirmDisabled,
	isPending,
	isEditing,
	onEditToggle,
	resolvedLabels,
	isConfirmedAnswer,
	testId,
	confirmStrength,
	...modeProps
}: Mode & {
	toolCallId: string;
	toolName: string;
	icon: LucideIcon;
	title: string;
	/** The proposal itself: a read view, or the fields while editing (an update card shows its diff when not editing). */
	children?: ReactNode;
	/** Duplicate, stale-record or safety warnings, above the actions. */
	warnings?: ReactNode;
	error?: string;
	confirmLabel: string;
	/**
	 * Runs the mutation. Return its promise: the card stays locked while it runs and settles once it resolves. Return
	 * nothing when the confirm stopped early (e.g. a validation error), or resolve to `false` when nothing was saved
	 * (e.g. duplicates to resolve first), and the card unlocks.
	 */
	onConfirm: (confirm: ProposalConfirm) => Promise<unknown> | void;
	isConfirmDisabled?: boolean;
	isPending?: boolean;
	isEditing?: boolean;
	/** Omit for a proposal that can't be edited. */
	onEditToggle?: () => void;
	/** The settled line, for a confirmed and for a cancelled (or otherwise answered) card. */
	resolvedLabels: { confirmed: string; cancelled: string };
	/** Whether the clinician's next chat message says the card was confirmed. */
	isConfirmedAnswer: (answer: string) => boolean;
	testId?: string;
	/** `strong`: a second click ("Yes, …") before the mutation runs, as a destructive card has (critical results). */
	confirmStrength?: 'standard' | 'reason' | 'strong';
}) {
	const mode = modeProps.mode ?? 'create';
	const queryClient = useQueryClient();
	const { queueOrSendMessage, isRunning, chatId } = useAgentContext();
	const answer = useAgentMessagesSelector((messages) => findAnswerForToolCall(messages, toolCallId));
	const outcomes = useQuery(
		wiseProposalApi.wiseProposal.outcomes.queryOptions({ chatId: chatId ?? '' }, { enabled: !!chatId }),
	);
	const cancel = useMutation(
		wiseProposalApi.wiseProposal.cancel.mutationOptions({
			onSettled: () => void queryClient.invalidateQueries(wiseProposalApi.wiseProposal.outcomes.pathFilter()),
			onSuccess: () => void queueOrSendMessage({ text: 'Cancel this proposal.' }),
		}),
	);
	const lock = useRef(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isConfirmedHere, setIsConfirmedHere] = useState(false);
	const [reason, setReason] = useState('');
	const [isArmed, setIsArmed] = useState(false);

	const outcome = outcomes.data?.find((candidate) => candidate.toolCallId === toolCallId)?.status;
	const settled = isConfirmedHere
		? 'confirmed'
		: (outcome ?? (answer === null ? null : isConfirmedAnswer(answer) ? 'confirmed' : 'cancelled'));

	if (settled) {
		return (
			<div className={styles.proposalCardResolved} data-testid={testId} data-settled={settled}>
				<Icon />
				<span className={styles.proposalCardTitle}>{title}</span>
				<span>{settled === 'confirmed' ? resolvedLabels.confirmed : resolvedLabels.cancelled}</span>
			</div>
		);
	}

	const origin = chatId ? { chatId, toolCallId, toolName } : null;
	const busy = isRunning || isPending || isSubmitting || cancel.isPending;
	const needsReason = mode === 'destructive';
	const needsSecondClick = needsReason || confirmStrength === 'strong';
	const reasonOk = reason.trim().length >= DESTRUCTIVE_REASON_MIN_LENGTH;
	const nothingChanged = modeProps.mode === 'update' && !modeProps.changes.some((change) => change.changed);
	const isStale = !!error && isStaleEditMessage(error);

	const confirm = async () => {
		if (lock.current || !origin) {
			return;
		}
		if (needsSecondClick && !isArmed) {
			setIsArmed(true);
			return;
		}
		lock.current = true;
		setIsSubmitting(true);
		try {
			const submitted = onConfirm({ origin, ...(needsReason && { reason: reason.trim() }) });
			if (submitted && (await submitted) !== false) {
				setIsConfirmedHere(true);
				void queryClient.invalidateQueries(wiseProposalApi.wiseProposal.outcomes.pathFilter());
				return;
			}
		} catch {
			// The caller shows its mutation's error; the card unlocks for another try, unless the API settled it.
			void queryClient.invalidateQueries(wiseProposalApi.wiseProposal.outcomes.pathFilter());
		} finally {
			setIsSubmitting(false);
		}
		lock.current = false;
		setIsArmed(false);
	};

	return (
		<div className={styles.proposalCard} data-testid={testId} data-mode={mode}>
			<div className={styles.proposalCardHeader}>
				<Icon />
				<span>{title}</span>
				<span
					className={[
						styles.proposalCardBadge,
						mode === 'update' && styles.proposalCardBadgeWarn,
						mode === 'destructive' && styles.proposalCardBadgeDanger,
					]
						.filter(Boolean)
						.join(' ')}
				>
					{BADGES[mode]}
				</span>
			</div>
			{'target' in modeProps && (
				<p className={styles.proposalCardTarget} data-testid='proposal-target'>
					{modeProps.target.label}
					{modeProps.target.detail && (
						<span className={styles.proposalCardTargetDetail}> · {modeProps.target.detail}</span>
					)}
				</p>
			)}
			{modeProps.mode === 'update' && !isEditing ? <ProposalDiff changes={modeProps.changes} /> : children}
			{needsReason && (
				<label className={styles.proposalCardReason}>
					Reason (required)
					<Textarea
						value={reason}
						rows={2}
						disabled={busy}
						onChange={(event) => {
							setReason(event.target.value);
							setIsArmed(false);
						}}
					/>
				</label>
			)}
			{warnings}
			{isStale ? (
				<div className={styles.proposalCardStale} role='alert'>
					<span>{error}</span>
					<Button
						size='sm'
						variant='outline'
						disabled={isRunning}
						onClick={() => void queueOrSendMessage({ text: REDRAFT_MESSAGE })}
					>
						Re-draft
					</Button>
				</div>
			) : (
				(error || cancel.error) && <ErrorMessage message={error ?? cancel.error!.message} />
			)}
			<div className={styles.proposalCardActions}>
				<Button
					variant='ghost-muted'
					size='sm'
					disabled={busy || !origin}
					onClick={() => origin && cancel.mutate({ ...origin, edited: false })}
				>
					<X />
					Cancel
				</Button>
				{onEditToggle && (
					<Button variant='outline' size='sm' disabled={isPending || isSubmitting} onClick={onEditToggle}>
						<Pencil />
						{isEditing ? 'Done' : 'Edit'}
					</Button>
				)}
				<Button
					size='sm'
					variant={mode === 'destructive' ? 'destructive' : undefined}
					disabled={
						busy || !origin || isStale || isConfirmDisabled || nothingChanged || (needsReason && !reasonOk)
					}
					onClick={() => void confirm()}
				>
					<Check />
					{isArmed ? `Yes, ${confirmLabel.toLowerCase()}` : confirmLabel}
				</Button>
			</div>
		</div>
	);
}
