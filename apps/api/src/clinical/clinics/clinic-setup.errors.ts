import { DomainError } from '../../common/errors/domain-error.js';

/** A clinic's code is printed in its document numbers and is unique in the organization. */
export class ClinicCodeTakenError extends DomainError {
	constructor(code: string) {
		super('CONFLICT', 'CLINIC_CODE_TAKEN', `Another clinic of the organization already uses the code ${code}.`, {
			code,
		});
	}
}

/** A clinic's name is unique in the organization. */
export class ClinicNameTakenError extends DomainError {
	constructor(name: string) {
		super('CONFLICT', 'CLINIC_NAME_TAKEN', `A clinic named "${name}" already exists.`, { name });
	}
}

/** The organization's legal details (TIN, VAT, SEC/DTI) are changed by its ADMIN or a SUPER_ADMIN. */
export class OrganizationAdminRequiredError extends DomainError {
	constructor() {
		super(
			'FORBIDDEN',
			'ORGANIZATION_ADMIN_REQUIRED',
			"Only an admin of the organization or a super admin can change the organization's legal details.",
		);
	}
}

/**
 * A document number prefix must keep numbers unique: sequences restart every year, so the prefix carries the year,
 * and only letters, digits and `-` / `/` are allowed.
 */
export class InvalidSequenceFormatError extends DomainError {
	constructor(message: string) {
		super('BAD_REQUEST', 'INVALID_SEQUENCE_FORMAT', message);
	}
}

/** A document sequence key the clinic doesn't number. */
export class UnknownSequenceKeyError extends DomainError {
	constructor(key: string) {
		super('BAD_REQUEST', 'UNKNOWN_SEQUENCE_KEY', `${key} is not a numbered document.`, { key });
	}
}
