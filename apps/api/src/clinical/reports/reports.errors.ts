import { DomainError } from '../../common/errors/domain-error.js';

/** Only a report about one patient has a chart to be saved to. */
export class ReportWithoutPatientError extends DomainError {
	constructor() {
		super(
			'BAD_REQUEST',
			'REPORT_WITHOUT_PATIENT',
			'This report is not about one patient, so it has no chart to go to.',
		);
	}
}

/** A report version is saved to the chart once (`clinical_documents.source_tool_call_id` is unique). */
export class ReportAlreadySavedError extends DomainError {
	constructor() {
		super('CONFLICT', 'REPORT_ALREADY_SAVED', 'This version is already saved to the chart.');
	}
}
