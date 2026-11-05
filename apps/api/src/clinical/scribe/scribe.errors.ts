import { DomainError } from '../../common/errors/domain-error.js';

/** A consult is recorded only with the patient's consent for that visit (DESIGN.md §8.7); typing still works. */
export class RecordingConsentRequiredError extends DomainError {
	constructor(encounterNo: string) {
		super(
			'FORBIDDEN',
			'RECORDING_CONSENT_REQUIRED',
			`The patient hasn't consented to recording visit ${encounterNo}. Ask for consent, or type the dictation.`,
			{ encounterNo },
		);
	}
}

/** The AI scribe drafts for one of the chat's patient's visits only. */
export class ScribeEncounterNotFoundError extends DomainError {
	constructor(encounterId: string) {
		super(
			'NOT_FOUND',
			'SCRIBE_ENCOUNTER_NOT_FOUND',
			"That visit isn't this patient's, or you can't see it. Use the encounter id from the patient record.",
			{ encounterId },
		);
	}
}
