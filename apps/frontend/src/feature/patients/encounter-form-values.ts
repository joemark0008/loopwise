import { encounterDraftErrors } from '@loopwise/shared/encounter';
import type { EncounterType } from '@loopwise/shared/encounter';
import type { CreateEncounterInput } from '@/graphql/generated/graphql';

/** How a new visit starts: checked in and waiting (OPEN), straight in with the doctor, or the API's default. */
export type InitialEncounterStatus = 'OPEN' | 'IN_PROGRESS' | '';

/** What the New encounter form and the Wise card edit. `startedAt` is a `datetime-local` value (local time). */
export interface EncounterFormValues {
	clinicId: string;
	type: EncounterType;
	/** Empty: the API decides (IN_PROGRESS for a practitioner, OPEN at the front desk). */
	status: InitialEncounterStatus;
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

/** The clinic a new visit starts at: the active clinic (the clinic selector) when it is offered, else the first. */
export function defaultEncounterClinicId(clinics: { id: string }[], activeClinicId: string | null): string {
	return clinics.find((clinic) => clinic.id === activeClinicId)?.id ?? clinics[0]?.id ?? '';
}

export const emptyEncounterForm = (clinicId = '', now = new Date()): EncounterFormValues => ({
	clinicId,
	type: 'CONSULTATION',
	status: '',
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
		type: values.type,
		notes: values.notes,
		startedAt: toIso(values.startedAt),
	});
	if (!values.clinicId) {
		errors.clinicId = 'Choose the clinic.';
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
		clinicId: values.clinicId,
		type: values.type,
		status: values.status || null,
		reason: values.reason,
		notes: values.notes.trim() ? values.notes : null,
		startedAt: toIso(values.startedAt) ?? null,
		sourceChatId: sourceChatId ?? null,
	};
}
