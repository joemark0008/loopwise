import { DomainError } from '../../common/errors/domain-error.js';

/** RA 10173 (Data Privacy Act): a patient is registered only with their recorded consent. */
export class ConsentRequiredError extends DomainError {
	constructor() {
		super('BAD_REQUEST', 'CONSENT_REQUIRED', 'Record the patient’s consent before registering them.');
	}
}

/** The fields of a patient draft broke the shared rules (`PatientDraftSchema`). */
export class InvalidPatientDraftError extends DomainError {
	constructor(message: string) {
		super('BAD_REQUEST', 'INVALID_PATIENT_DRAFT', message);
	}
}

/** Patients are registered, and visits recorded, at a clinic the user works at (not as a viewer). */
export class ClinicNotAvailableError extends DomainError {
	constructor(action: string) {
		super('FORBIDDEN', 'CLINIC_NOT_AVAILABLE', `You can only ${action} at a clinic you work at.`);
	}
}

/** Linking an existing patient needs the registration draft to match them: knowing an id is never enough. */
export class PatientDoesNotMatchError extends DomainError {
	constructor() {
		super('FORBIDDEN', 'PATIENT_DOES_NOT_MATCH', 'This patient does not match the registration details.');
	}
}

/** Contact details are kept by the staff of the patient's organization. */
export class PatientOutsideOrganizationError extends DomainError {
	constructor() {
		super(
			'FORBIDDEN',
			'PATIENT_OUTSIDE_ORGANIZATION',
			"Only staff at a clinic of the patient's organization can change this record.",
		);
	}
}

/** An update with no field to change. */
export class NothingToChangeError extends DomainError {
	constructor() {
		super('BAD_REQUEST', 'NOTHING_TO_CHANGE', 'Nothing to change.');
	}
}

/** A voided entry stays as it is. */
export class AlreadyVoidedError extends DomainError {
	constructor(what: string) {
		super('CONFLICT', 'ALREADY_VOIDED', `This ${what} is already voided.`);
	}
}

/** A shared zod rule refused a field (void reason, allergy draft …). */
export class InvalidInputError extends DomainError {
	constructor(message: string) {
		super('BAD_REQUEST', 'INVALID_INPUT', message);
	}
}
