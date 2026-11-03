import { encounterDraftErrors } from '@quarry/shared/encounter';
import type { CreateEncounterInput } from '@/graphql/generated/graphql';

/** What the New encounter form and the Wise card edit. `startedAt` is a `datetime-local` value (local time). */
export interface EncounterFormValues {
	facilityId: string;
	reason: string;
	notes: string;
	startedAt: string;
}

export type EncounterFormErrors = Partial<Record<keyof EncounterFormValues, string>>;

/** `YYYY-MM-DDTHH:mm` in local time, as a `datetime-local` input shows it. */
export function toLocalInput(date: Date): string {
	const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
	return local.toISOString().slice(0, 16);
}

/**
 * The `datetime-local` value of a start time the model drafted. A bare date (`2026-11-03`) is a day, not UTC
 * midnight: today means now, another day 09:00 local. Unparseable values fall back to now.
 */
export function draftStartToLocalInput(value: string | undefined, now = new Date()): string {
	if (value && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
		const day = value.trim();
		return day === toLocalInput(now).slice(0, 10) ? toLocalInput(now) : `${day}T09:00`;
	}
	return value && !Number.isNaN(Date.parse(value)) ? toLocalInput(new Date(value)) : toLocalInput(now);
}

export const emptyEncounterForm = (facilityId = '', now = new Date()): EncounterFormValues => ({
	facilityId,
	reason: '',
	notes: '',
	startedAt: toLocalInput(now),
});

/** ISO 8601 for the API; an unparseable value is passed on as is, for the shared schema to reject. */
const toIso = (local: string) => {
	if (!local.trim()) {
		return undefined;
	}
	const time = Date.parse(local);
	return Number.isNaN(time) ? local : new Date(time).toISOString();
};

export function validateEncounterForm(values: EncounterFormValues): EncounterFormErrors {
	const errors: EncounterFormErrors = encounterDraftErrors({
		reason: values.reason,
		notes: values.notes,
		startedAt: toIso(values.startedAt),
	});
	if (!values.facilityId) {
		errors.facilityId = 'Choose the facility.';
	}
	return errors;
}

export function toCreateEncounterInput(
	patientId: string,
	values: EncounterFormValues,
	sourceChatId?: string,
): CreateEncounterInput {
	return {
		patientId,
		facilityId: values.facilityId,
		reason: values.reason,
		notes: values.notes.trim() ? values.notes : null,
		startedAt: toIso(values.startedAt) ?? null,
		sourceChatId: sourceChatId ?? null,
	};
}
