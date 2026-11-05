import { SCRIBE_LANGUAGES, SCRIBE_TOOL_NAME, scribeOutcomeKey } from '@loopwise/shared/scribe';
import type { ScribeLanguage } from '@loopwise/shared/scribe';
import type { proposeScribeNote } from '@loopwise/shared/tools';
import type { UIMessage } from '@loopwise/api/agent/types/chat';
import type { NoteFormValues } from '@/feature/encounters/encounter-form-values';

/*
 * The AI scribe's draft as the panel reads it (DESIGN.md §7.5): the latest `propose_scribe_note` call for a visit in
 * the chart chat, its parts, and how far the doctor got through them. Pure, so it is tested without the agent.
 */

export interface ScribeToolPart {
	type: string;
	toolCallId: string;
	state: string;
	input?: unknown;
	output?: unknown;
	errorText?: string;
}

/** The latest scribe draft of the visit in the chat (streaming, failed or done), or null. */
export function latestScribeDraft(messages: readonly UIMessage[], encounterId: string): ScribeToolPart | null {
	for (let m = messages.length - 1; m >= 0; m -= 1) {
		const parts = messages[m].parts as readonly ScribeToolPart[];
		for (let p = parts.length - 1; p >= 0; p -= 1) {
			const part = parts[p];
			if (part.type !== `tool-${SCRIBE_TOOL_NAME}`) {
				continue;
			}
			const output = part.output as proposeScribeNote.Output | undefined;
			const input = part.input as Partial<proposeScribeNote.Input> | undefined;
			if ((output?.encounter?.id ?? input?.encounterId?.trim()) === encounterId) {
				return part;
			}
		}
	}
	return null;
}

/** Selector equality: the same call in the same state is the same draft. */
export const sameDraft = (left: ScribeToolPart | null, right: ScribeToolPart | null) =>
	left?.toolCallId === right?.toolCallId && left?.state === right?.state && left?.output === right?.output;

/** The note fields the SOAP card changes, in the note's order, with the labels of its before → after. */
export const SOAP_LABELS = {
	reason: 'Chief complaint',
	history: 'History of present illness',
	reviewOfSystems: 'Review of systems',
	subjective: 'Other subjective',
	physicalExam: 'Physical exam',
	objective: 'Other objective',
	assessment: 'Assessment',
	plan: 'Plan',
} as const;
export type SoapField = keyof typeof SOAP_LABELS;
export const SOAP_FIELDS = Object.keys(SOAP_LABELS) as SoapField[];

/** The note with the drafted SOAP sections written over the current ones; a section not drafted stays as it is. */
export function soapDraftValues(current: NoteFormValues, soap: proposeScribeNote.Input['soap']): NoteFormValues {
	const drafted: Partial<Record<SoapField, string | undefined>> = {
		reason: soap?.chiefComplaint,
		history: soap?.history,
		reviewOfSystems: soap?.reviewOfSystems,
		subjective: soap?.subjective,
		physicalExam: soap?.physicalExam,
		objective: soap?.objective,
		assessment: soap?.assessment,
		plan: soap?.plan,
	};
	const next = { ...current };
	for (const field of SOAP_FIELDS) {
		const text = drafted[field]?.trim();
		if (text) {
			next[field] = text;
		}
	}
	return next;
}

const DAY_MS = 86_400_000;

/** The follow-up date: the one said, else the interval counted from the visit's day; '' when neither. */
export function followUpDate(followUp: proposeScribeNote.Input['followUp'], visitStartedAt: string): string {
	if (followUp?.date && /^\d{4}-\d{2}-\d{2}$/.test(followUp.date.trim())) {
		return followUp.date.trim();
	}
	if (followUp?.inDays) {
		const day = Date.parse(`${visitStartedAt.slice(0, 10)}T00:00:00Z`);
		return new Date(day + followUp.inDays * DAY_MS).toISOString().slice(0, 10);
	}
	return '';
}

/** The summary language from the patient's preferred language (`ceb`, `fil`, `en`, or a name), English otherwise. */
export function summaryLanguageFor(preferredLanguage: string | null | undefined): ScribeLanguage {
	const value = preferredLanguage?.trim().toLowerCase() ?? '';
	if ((SCRIBE_LANGUAGES as readonly string[]).includes(value)) {
		return value as ScribeLanguage;
	}
	if (/cebuano|bisaya|binisaya/.test(value)) {
		return 'ceb';
	}
	if (/filipino|tagalog/.test(value)) {
		return 'fil';
	}
	return 'en';
}

export interface ScribeProgress {
	total: number;
	confirmed: number;
	edited: number;
	dismissed: number;
	open: number;
}

/** How many parts the doctor confirmed (and of those, edited), dismissed, and has still to decide. */
export function scribeProgress(
	toolCallId: string,
	parts: readonly string[],
	outcomes: readonly { toolCallId: string; status: string; edited: boolean }[],
): ScribeProgress {
	const progress: ScribeProgress = { total: parts.length, confirmed: 0, edited: 0, dismissed: 0, open: 0 };
	for (const part of parts) {
		const outcome = outcomes.find((candidate) => candidate.toolCallId === scribeOutcomeKey(toolCallId, part));
		if (!outcome) {
			progress.open += 1;
		} else if (outcome.status === 'confirmed') {
			progress.confirmed += 1;
			progress.edited += outcome.edited ? 1 : 0;
		} else {
			progress.dismissed += 1;
		}
	}
	return progress;
}

/** "3 of 9 saved (1 edited) · 1 dismissed · 5 to review". */
export function progressLine(progress: ScribeProgress): string {
	return [
		`${progress.confirmed} of ${progress.total} saved${progress.edited ? ` (${progress.edited} edited)` : ''}`,
		progress.dismissed && `${progress.dismissed} dismissed`,
		progress.open && `${progress.open} to review`,
	]
		.filter(Boolean)
		.join(' · ');
}
