import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Children, useState } from 'react';
import { PRIORITY_REASON_LABELS } from './scheduling-format';
import { QueueStatusBadge, TicketCode, WaitTime } from './scheduling-parts';
import type { QueueTicketFieldsFragment } from '@/graphql/generated/graphql';
import type { ReactNode } from 'react';
import { ClinicalFlag } from '@/components/clinical/clinical-flag';
import { ErrorMessage } from '@/components/ui/error-message';
import { Button } from '@/components/ui/button';
import { VoidDialog } from '@/feature/encounters/void-dialog';
import { schedulingApi } from '@/lib/scheduling-api';
import { cn } from '@/lib/utils';

/**
 * One ticket in a line, as a card: the number tile, the patient (when the user may see them), the reason, the priority
 * reason and how long they have waited, the status, then the desk's actions. `compact` for the day's done list.
 */
export function TicketItem({
	ticket,
	children,
	compact,
}: {
	ticket: QueueTicketFieldsFragment;
	children?: ReactNode;
	compact?: boolean;
}) {
	// Conditional actions render as `false`: only a real one gets the action bar.
	const hasActions = Children.toArray(children).length > 0;
	return (
		<li
			className={cn(
				'flex flex-col rounded-xl border bg-card text-card-foreground',
				compact ? 'px-3 py-2.5' : 'p-3 shadow-xs',
				ticket.status === 'CALLED' && 'border-abnormal-line',
				ticket.status === 'SERVING' && 'border-info/40',
			)}
			data-testid='queue-ticket'
			data-code={ticket.code}
			data-status={ticket.status}
		>
			<div className='flex items-start gap-3'>
				<TicketCode ticket={ticket} />
				<div className='flex min-w-0 flex-1 flex-col gap-0.5'>
					<p className='truncate font-semibold text-foreground'>{ticket.patient?.name ?? 'Patient'}</p>
					<p className={cn('text-xs text-muted-foreground', compact ? 'truncate' : 'line-clamp-2')}>
						{ticket.encounter?.reason ?? 'No reason given'}
					</p>
				</div>
				{compact && <QueueStatusBadge status={ticket.status} />}
			</div>
			{!compact && (
				<div className='mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-2'>
					<QueueStatusBadge status={ticket.status} />
					{ticket.priorityReason && (
						<ClinicalFlag tone='critical' icon={null}>
							{PRIORITY_REASON_LABELS[ticket.priorityReason]}
						</ClinicalFlag>
					)}
					{ticket.status === 'WAITING' && <WaitTime since={ticket.issuedAt} />}
					{hasActions && (
						<div className='ml-auto flex flex-wrap items-center justify-end gap-1.5'>{children}</div>
					)}
				</div>
			)}
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
