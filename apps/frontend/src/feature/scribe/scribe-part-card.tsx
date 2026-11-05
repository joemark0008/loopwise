import { SCRIBE_TOOL_NAME } from '@loopwise/shared/scribe';
import type { proposeScribeNote } from '@loopwise/shared/tools';
import type { ComponentProps } from 'react';
import type { EncounterRecordFieldsFragment } from '@/graphql/generated/graphql';
import { ProposalCard } from '@/feature/chat/components/tool-calls/proposal-card/proposal-card';

/** What every part card of a scribe draft gets: the call, its part, the draft, what the API resolved, the visit. */
export interface ScribePartProps {
	toolCallId: string;
	part: string;
	draft: proposeScribeNote.Input;
	output: proposeScribeNote.Output;
	record: EncounterRecordFieldsFragment;
}

const RESOLVED = { confirmed: 'Saved', cancelled: 'Dismissed' };

type CardProps = ComponentProps<typeof ProposalCard>;
/** `Omit` that keeps the card's mode union (create / update / destructive) apart. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/**
 * One part of a scribe draft on the shared proposal card (DESIGN.md §7.1): Confirm calls the part's own mutation with
 * the card's origin and its part, and it settles from the API's outcome only; Dismiss settles it without saving.
 */
export function ScribePartCard(
	props: DistributiveOmit<
		CardProps,
		'toolName' | 'resolvedLabels' | 'isConfirmedAnswer' | 'part' | 'testId' | 'cancelLabel'
	> & {
		part: string;
	},
) {
	return (
		<ProposalCard
			{...(props as CardProps)}
			toolName={SCRIBE_TOOL_NAME}
			resolvedLabels={RESOLVED}
			isConfirmedAnswer={() => false}
			cancelLabel='Dismiss'
			testId={`scribe-part-${props.part}`}
		/>
	);
}
