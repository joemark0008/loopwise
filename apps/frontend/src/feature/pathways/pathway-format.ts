import type { CaseState, Urgency } from '@/graphql/generated/graphql';

const CASE_STATES: Record<CaseState, string> = {
	open: 'Open (review)',
	notified: 'Notified',
	acknowledged: 'Acknowledged',
	confirming: 'Confirming',
	referred: 'Referred',
	accepted: 'Accepted',
	seen: 'Seen',
	treatment_started: 'Treatment started',
	closed: 'Closed',
	escalated: 'Escalated to a clinician',
	lost_to_follow_up: 'Lost to follow-up',
};

/** A case state (DESIGN.md §6) in words. */
export const caseStateLabel = (state: CaseState) => CASE_STATES[state];

const URGENCIES: Record<Urgency, string> = { routine: 'Routine', soon: 'Soon', urgent: 'Urgent', critical: 'Critical' };

export const urgencyLabel = (urgency: Urgency) => URGENCIES[urgency];

/** An SLA in hours as people say it: "1 h", "48 h", "14 days". */
export function slaLabel(hours: number | null | undefined): string {
	if (hours == null) {
		return '—';
	}
	return hours >= 72 && hours % 24 === 0 ? `${hours / 24} days` : `${hours} h`;
}

const EVIDENCE: Record<string, string> = {
	result: 'confirmatory result',
	visit_note: 'visit note',
	dispense: 'dispense',
	signoff: 'clinician sign-off',
};

export const evidenceLabel = (type: string) => EVIDENCE[type] ?? type;
