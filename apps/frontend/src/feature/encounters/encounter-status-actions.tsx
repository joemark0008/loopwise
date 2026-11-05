import { ENCOUNTER_STATUS_TRANSITIONS } from '@loopwise/shared/encounter';
import { useState } from 'react';
import styles from './encounter.module.css';
import { useRecordMutation } from './use-record-mutation';
import { VoidDialog } from './void-dialog';
import type { EncounterStatus } from '@loopwise/shared/encounter';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { encounterApi } from '@/lib/encounter-api';

/** What each move is called on its button. */
const MOVE_LABELS: Record<EncounterStatus, string> = {
	OPEN: 'Back to waiting',
	IN_PROGRESS: 'Start consult',
	FOR_BILLING: 'Send to billing',
	COMPLETED: 'Complete visit',
	CANCELLED: 'Cancel visit',
};

/**
 * The moves the visit may make from its status (`ENCOUNTER_STATUS_TRANSITIONS`, the API's status machine), against
 * the version on screen. From billing, going back to the doctor is labelled as reopening; cancelling asks why.
 */
export function EncounterStatusActions({
	encounterId,
	status,
	version,
}: {
	encounterId: string;
	status: EncounterStatus;
	version: number;
}) {
	const transition = useRecordMutation(encounterApi.encounter.transition);
	const [isCancelOpen, setIsCancelOpen] = useState(false);
	const moves = ENCOUNTER_STATUS_TRANSITIONS[status];
	if (moves.length === 0) {
		return null;
	}
	const move = (next: EncounterStatus, reason?: string) =>
		transition.mutate(
			{ encounterId, status: next, expectedVersion: version, reason: reason ?? null },
			{ onSuccess: () => setIsCancelOpen(false) },
		);

	return (
		<div className={styles.actions} data-testid='encounter-status-actions'>
			{moves
				.filter((next) => next !== 'CANCELLED')
				.map((next, index) => (
					<Button
						key={next}
						size='sm'
						variant={index === 0 ? 'default' : 'outline'}
						disabled={transition.isPending}
						onClick={() => move(next)}
					>
						{status === 'FOR_BILLING' && next === 'IN_PROGRESS' ? 'Reopen consult' : MOVE_LABELS[next]}
					</Button>
				))}
			{moves.includes('CANCELLED') && (
				<Button
					size='sm'
					variant='ghost-muted'
					disabled={transition.isPending}
					onClick={() => setIsCancelOpen(true)}
				>
					{MOVE_LABELS.CANCELLED}
				</Button>
			)}
			{transition.error && !isCancelOpen && <ErrorMessage message={transition.error.message} />}
			<VoidDialog
				open={isCancelOpen}
				onOpenChange={setIsCancelOpen}
				title='Cancel this visit?'
				description='A cancelled visit stays in the chart, and its record can no longer change.'
				onVoid={(reason) => move('CANCELLED', reason)}
				isPending={transition.isPending}
				error={transition.error?.message}
				actionLabel='Cancel visit'
				placeholder='Left before being seen'
			/>
		</div>
	);
}
