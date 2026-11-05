import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import styles from './scheduling.module.css';
import { PRIORITY_REASON_LABELS, waited } from './scheduling-format';
import { QueueStatusBadge, TicketCode } from './scheduling-parts';
import type { QueueTicketFieldsFragment } from '@/graphql/generated/graphql';
import type { ReactNode } from 'react';
import { ErrorMessage } from '@/components/ui/error-message';
import { Button } from '@/components/ui/button';
import { VoidDialog } from '@/feature/encounters/void-dialog';
import { schedulingApi } from '@/lib/scheduling-api';

/** One ticket in a line: number, patient (when the user may see them), reason, waiting time and the desk's actions. */
export function TicketItem({ ticket, children }: { ticket: QueueTicketFieldsFragment; children?: ReactNode }) {
	return (
		<li className={styles.ticket} data-testid='queue-ticket' data-code={ticket.code} data-status={ticket.status}>
			<TicketCode ticket={ticket} />
			<div className={styles.ticketBody}>
				<div className={styles.main}>{ticket.patient?.name ?? 'Patient'}</div>
				<div className={styles.muted}>
					{ticket.encounter?.reason ?? 'No reason given'}
					{ticket.priorityReason && ` · ${PRIORITY_REASON_LABELS[ticket.priorityReason]}`}
					{ticket.status === 'WAITING' && ` · waiting ${waited(ticket.issuedAt)}`}
				</div>
			</div>
			<QueueStatusBadge status={ticket.status} />
			{children && <div className={styles.actions}>{children}</div>}
		</li>
	);
}

/** The moves of one ticket, each refreshing every line and the board. */
export function useTicketMoves() {
	const queryClient = useQueryClient();
	const refresh = { onSettled: () => queryClient.invalidateQueries(schedulingApi.invalidate) };
	const moves = {
		call: useMutation(schedulingApi.call.mutationOptions(refresh)),
		start: useMutation(schedulingApi.start.mutationOptions(refresh)),
		send: useMutation(schedulingApi.send.mutationOptions(refresh)),
		complete: useMutation(schedulingApi.complete.mutationOptions(refresh)),
		skip: useMutation(schedulingApi.skip.mutationOptions(refresh)),
		requeue: useMutation(schedulingApi.requeue.mutationOptions(refresh)),
		cancel: useMutation(schedulingApi.cancelTicket.mutationOptions(refresh)),
	};
	const all = Object.values(moves);
	return {
		...moves,
		isPending: all.some((move) => move.isPending),
		error: all.find((move) => move.error)?.error ?? null,
	};
}

/** "Cancel visit" with its reason: the patient left before the doctor; the visit and the booking close too. */
export function CancelTicketButton({ ticket }: { ticket: QueueTicketFieldsFragment }) {
	const [open, setOpen] = useState(false);
	const queryClient = useQueryClient();
	const cancel = useMutation(
		schedulingApi.cancelTicket.mutationOptions({
			onSuccess: () => setOpen(false),
			onSettled: () => queryClient.invalidateQueries(schedulingApi.invalidate),
		}),
	);
	const name = ticket.patient?.name ?? ticket.code;
	return (
		<>
			<Button size='sm' variant='ghost-muted' onClick={() => setOpen(true)} aria-label={`Cancel ${name}'s visit`}>
				Cancel
			</Button>
			<VoidDialog
				open={open}
				onOpenChange={setOpen}
				title={`Cancel ${ticket.code}?`}
				description='The patient left before the doctor saw them. The visit and the booking are cancelled with your reason.'
				actionLabel='Cancel visit'
				placeholder='Left before triage'
				onVoid={(reason) => cancel.mutate({ ticketId: ticket.id, reason })}
				isPending={cancel.isPending}
				error={cancel.error?.message}
			/>
		</>
	);
}

export function MoveError({ error }: { error: Error | null }) {
	return error ? <ErrorMessage message={error.message} /> : null;
}
