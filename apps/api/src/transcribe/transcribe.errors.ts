import { DomainError } from '../common/errors/domain-error.js';

/** The clinic turned transcription off (Settings → Clinic → Agent → Transcription): no audio leaves for the provider. */
export class TranscriptionDisabledError extends DomainError {
	constructor() {
		super(
			'FORBIDDEN',
			'TRANSCRIPTION_DISABLED',
			'Transcription is off for this clinic. Turn it on in Settings → Clinic → Agent, or type the dictation.',
		);
	}
}
