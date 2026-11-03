import { ClinicalFlag } from './clinical-flag';
import type { ClinicalTone } from './clinical-flag';

/**
 * The status of a record (document, bill, order) in words, with one tone per meaning across the app: drafts are
 * dashed, issued/paid/closed are done, voided and cancelled are struck off.
 */
const STATUS: Record<string, { tone: ClinicalTone; label: string }> = {
	draft: { tone: 'draft', label: 'Draft' },
	issued: { tone: 'done', label: 'Issued' },
	finalized: { tone: 'info', label: 'Finalized' },
	paid: { tone: 'done', label: 'Paid' },
	voided: { tone: 'void', label: 'Voided' },
	cancelled: { tone: 'void', label: 'Cancelled' },
	rejected: { tone: 'void', label: 'Rejected' },
	sent: { tone: 'info', label: 'Sent' },
	accepted: { tone: 'info', label: 'Accepted' },
	collected: { tone: 'info', label: 'Collected' },
	resulted: { tone: 'abnormal', label: 'Awaiting review' },
	reviewed: { tone: 'done', label: 'Reviewed' },
};

/** The status in words, e.g. for a line of text. */
export const statusLabel = (status: string) => STATUS[status]?.label ?? status;

export function StatusBadge({ status, title }: { status: string; title?: string }) {
	const { tone, label } = STATUS[status] ?? { tone: 'info' as const, label: status };
	return (
		<ClinicalFlag tone={tone} title={title}>
			{label}
		</ClinicalFlag>
	);
}
