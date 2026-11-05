import { DomainError } from '../../common/errors/domain-error.js';

/** A report needs its subject: the patient (patient summary), the visit (encounter summary) or the clinic (panel). */
export class ReportSubjectMissingError extends DomainError {
	constructor(message: string) {
		super('BAD_REQUEST', 'REPORT_SUBJECT_MISSING', message);
	}
}

/** Wise's narrative may only quote numbers the report's data sections hold, so it never invents a value. */
export class UngroundedNarrativeError extends DomainError {
	constructor(numbers: readonly string[]) {
		super(
			'BAD_REQUEST',
			'UNGROUNDED_NARRATIVE',
			`The narrative has numbers the report's data doesn't contain (${numbers.join(', ')}). Rewrite it without them and call create_report again.`,
		);
	}
}

/** The clinic panel is only for clinics the user works at; with several, they pick one. */
export class PanelClinicRequiredError extends DomainError {
	constructor(message: string) {
		super('BAD_REQUEST', 'PANEL_CLINIC_REQUIRED', message);
	}
}
