import { useQuery } from '@tanstack/react-query';
import { scribePartKind } from '@loopwise/shared/scribe';
import { progressLine, scribeProgress } from './scribe-draft';
import { FollowUpCard, SoapCard, SummaryCard } from './scribe-note-cards';
import { CertificateCard, DiagnosisCard, OrdersCard, PrescriptionCard, VitalsCard } from './scribe-record-cards';
import styles from './scribe.module.css';
import type { ScribeToolPart } from './scribe-draft';
import type { ScribePartProps } from './scribe-part-card';
import type { ScribePartKind } from '@loopwise/shared/scribe';
import type { proposeScribeNote } from '@loopwise/shared/tools';
import type { ComponentType } from 'react';
import type { EncounterRecordFieldsFragment } from '@/graphql/generated/graphql';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgentContext } from '@/contexts/agent.provider';
import { wiseProposalApi } from '@/lib/wise-proposal-api';

const CARDS: Record<ScribePartKind, ComponentType<ScribePartProps>> = {
	soap: SoapCard,
	vitals: VitalsCard,
	diagnosis: DiagnosisCard,
	prescription: PrescriptionCard,
	orders: OrdersCard,
	certificate: CertificateCard,
	follow_up: FollowUpCard,
	summary: SummaryCard,
};

/** How far the doctor got through a draft: saved (edited), dismissed, still to review. */
export function useScribeProgress(toolCallId: string, parts: readonly string[]) {
	const { chatId } = useAgentContext();
	const outcomes = useQuery(
		wiseProposalApi.wiseProposal.outcomes.queryOptions({ chatId: chatId ?? '' }, { enabled: !!chatId }),
	);
	return scribeProgress(toolCallId, parts, outcomes.data ?? []);
}

/**
 * The cards of one scribe draft (DESIGN.md §7.5), one per part, each confirmed, edited or dismissed on its own, with a
 * line saying how many are done. Nothing is saved until a card's Confirm.
 */
export function ScribeCards({ toolPart, record }: { toolPart: ScribeToolPart; record: EncounterRecordFieldsFragment }) {
	if (toolPart.state === 'input-streaming' || toolPart.state === 'input-available') {
		return (
			<div className={styles.cards} aria-busy='true'>
				<p className={styles.muted}>Wise is drafting the visit…</p>
				<Skeleton className={styles.skeleton} />
			</div>
		);
	}
	if (toolPart.state === 'output-error') {
		return <ErrorMessage message={toolPart.errorText ?? 'The draft failed. Try again.'} />;
	}
	const draft = toolPart.input as proposeScribeNote.Input | undefined;
	const output = toolPart.output as proposeScribeNote.Output | undefined;
	if (!draft || !output) {
		return null;
	}
	return <DraftCards toolCallId={toolPart.toolCallId} draft={draft} output={output} record={record} />;
}

function DraftCards({ toolCallId, draft, output, record }: Omit<ScribePartProps, 'part'> & { toolCallId: string }) {
	const progress = useScribeProgress(toolCallId, output.parts);
	return (
		<div className={styles.cards} data-testid='scribe-cards'>
			<p className={styles.muted} data-testid='scribe-progress' aria-live='polite'>
				{progressLine(progress)}. Nothing is saved until you confirm a card.
			</p>
			{output.parts.map((part) => {
				const kind = scribePartKind(part);
				const Card = kind && CARDS[kind];
				return Card ? (
					<Card
						key={`${toolCallId}-${part}`}
						toolCallId={toolCallId}
						part={part}
						draft={draft}
						output={output}
						record={record}
					/>
				) : null;
			})}
		</div>
	);
}
