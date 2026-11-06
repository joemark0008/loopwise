import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import styles from './follow-ups.module.css';
import type { ReferralListFieldsFragment } from '@/graphql/generated/graphql';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { ErrorMessage } from '@/components/ui/error-message';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/feature/encounters/form-field';
import { followUpApi, referralApi } from '@/lib/follow-up-api';

/** The answers a referral takes: SENT → ACCEPTED or DECLINED, ACCEPTED → COMPLETED. */
export type ReferralAnswer = 'accept' | 'decline' | 'complete';

const ANSWERS: Record<
	ReferralAnswer,
	{ title: string; action: string; label: string; placeholder: string; required: boolean }
> = {
	accept: {
		title: 'Accept the referral',
		action: 'Accept',
		label: 'Note (optional)',
		placeholder: 'Seen on Thursday at the IM clinic',
		required: false,
	},
	decline: {
		title: 'Decline the referral',
		action: 'Decline',
		label: 'Reason',
		placeholder: 'Better seen by endocrinology',
		required: true,
	},
	complete: {
		title: 'Complete the referral',
		action: 'Complete',
		label: 'Response notes',
		placeholder: 'What was found or done, for the referring doctor',
		required: true,
	},
};

/**
 * The answer to a referral, one status move with its note: accept (a note optional), decline (the reason) or complete
 * (the response notes for the referring doctor). Internal referrals are answered by the doctor they were sent to;
 * external ones are marked by the referring side.
 */
export function ReferralResponseDialog({
	referral,
	answer,
	onClose,
}: {
	referral: ReferralListFieldsFragment;
	answer: ReferralAnswer;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const [text, setText] = useState('');
	const spec = ANSWERS[answer];
	const done = {
		onSuccess: () => onClose(),
		onSettled: () =>
			Promise.all([
				queryClient.invalidateQueries(referralApi.invalidate),
				queryClient.invalidateQueries(followUpApi.invalidate),
			]),
	};
	const accept = useMutation(referralApi.accept.mutationOptions(done));
	const decline = useMutation(referralApi.decline.mutationOptions(done));
	const complete = useMutation(referralApi.complete.mutationOptions(done));
	const pending = accept.isPending || decline.isPending || complete.isPending;
	const error = accept.error ?? decline.error ?? complete.error;
	const blank = text.trim().length === 0;

	const submit = (event: React.FormEvent) => {
		event.preventDefault();
		if (spec.required && blank) {
			return;
		}
		const value = text.trim();
		if (answer === 'accept') {
			accept.mutate({ id: referral.id, notes: value || null });
		} else if (answer === 'decline') {
			decline.mutate({ id: referral.id, reason: value });
		} else {
			complete.mutate({ id: referral.id, responseNotes: value });
		}
	};

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<form onSubmit={submit} noValidate className={styles.form}>
					<DialogHeader>
						<DialogTitle>{spec.title}</DialogTitle>
						<DialogDescription>
							{referral.patientName} ({referral.patientNo}): {referral.reason}
						</DialogDescription>
					</DialogHeader>
					{referral.clinicalSummary && <p className={styles.summary}>{referral.clinicalSummary}</p>}
					<FormField label={spec.label}>
						{(id) => (
							<Textarea
								id={id}
								value={text}
								rows={4}
								placeholder={spec.placeholder}
								onChange={(event) => setText(event.target.value)}
								disabled={pending}
							/>
						)}
					</FormField>
					{error && <ErrorMessage message={error.message} />}
					<DialogFooter>
						<Button type='button' variant='ghost-muted' onClick={onClose}>
							Cancel
						</Button>
						<Button
							type='submit'
							variant={answer === 'decline' ? 'destructive' : 'default'}
							disabled={pending || (spec.required && blank)}
						>
							{spec.action}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
