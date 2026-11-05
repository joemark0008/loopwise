import { Link } from '@tanstack/react-router';
import { NotebookPen } from 'lucide-react';
import { memo } from 'react';
import { useScribeProgress } from './scribe-cards';
import { progressLine } from './scribe-draft';
import styles from './scribe.module.css';
import type { proposeScribeNote } from '@loopwise/shared/tools';
import type { ToolCallComponentProps } from '@/feature/chat/components/tool-calls';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * `propose_scribe_note` in the chat: a line about the draft and a link to the visit's AI scribe tab, where its cards
 * are confirmed one by one. The cards live on the visit so the doctor reviews them beside the record.
 */
export const ScribeDraftToolCall = memo(({ toolPart }: ToolCallComponentProps<'propose_scribe_note'>) => {
	if (toolPart.state === 'input-streaming' || toolPart.state === 'input-available') {
		return <Skeleton className={styles.skeleton} />;
	}
	if (toolPart.state === 'output-error') {
		return <ErrorMessage message={toolPart.errorText ?? 'The scribe draft failed.'} />;
	}
	const output = toolPart.output as proposeScribeNote.Output | undefined;
	if (!output) {
		return null;
	}
	return <DraftSummary toolCallId={toolPart.toolCallId} output={output} />;
});

function DraftSummary({ toolCallId, output }: { toolCallId: string; output: proposeScribeNote.Output }) {
	const progress = useScribeProgress(toolCallId, output.parts);
	return (
		<div className={styles.chatCard} data-testid='scribe-draft-chat'>
			<span className={styles.stepTitle}>
				<NotebookPen aria-hidden />
				AI scribe draft · {output.encounter.encounterNo}
			</span>
			<span className={styles.muted}>{progressLine(progress)}</span>
			<Link
				to='/patients/$patientId/encounters/$encounterId'
				params={{ patientId: output.patientId, encounterId: output.encounter.id }}
				search={{ tab: 'scribe' }}
			>
				Review the cards on the visit
			</Link>
		</div>
	);
}
