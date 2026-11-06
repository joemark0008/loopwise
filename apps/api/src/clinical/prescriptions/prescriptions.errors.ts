import type { AllergyWarning } from '@loopwise/shared/prescription';

import { DomainError } from '../../common/errors/domain-error.js';

/**
 * An item matches one of the patient's recorded allergies (by generic name or drug class, RA 6675): issuing waits
 * until the prescriber reviews the items or overrides the warning (the override is in the audit row).
 */
export class AllergyWarningError extends DomainError {
	constructor(warnings: readonly AllergyWarning[]) {
		const list = warnings.map((warning) => `${warning.genericName} (allergy: ${warning.allergen})`).join(', ');
		super('CONFLICT', 'ALLERGY_WARNING', `Allergy warning: ${list}. Review the items or override the warning.`, {
			items: warnings.map((warning) => warning.genericName).join(', '),
		});
	}
}

/** RA 9165: only a prescriber with a PDEA S2 license issues a dangerous-drug prescription. */
export class S2LicenseRequiredError extends DomainError {
	constructor() {
		super(
			'BAD_REQUEST',
			'S2_LICENSE_REQUIRED',
			'A dangerous-drug prescription needs your PDEA S2 license number (Settings → Account → practitioner profile).',
		);
	}
}

/** Only an issued prescription that is still active (or partly dispensed) is dispensed. */
export class PrescriptionNotDispensableError extends DomainError {
	constructor(rxNo: string, status: string) {
		super(
			'CONFLICT',
			'PRESCRIPTION_NOT_DISPENSABLE',
			`Prescription ${rxNo} can't be dispensed (${status.toLowerCase().replace('_', ' ')}).`,
			{ rxNo, status },
		);
	}
}

/** A dispense of nothing, or of more than is left to dispense on the item. */
export class DispenseQuantityError extends DomainError {
	constructor(genericName: string, remaining: number) {
		super(
			'BAD_REQUEST',
			'DISPENSE_QUANTITY_INVALID',
			`${genericName}: dispense more than 0 and at most what is left on the prescription (${remaining}).`,
			{ genericName, remaining },
		);
	}
}

/** The shared rules (`PrescriptionDraftSchema`) refused the draft. */
export class InvalidPrescriptionDraftError extends DomainError {
	constructor(message: string) {
		super('BAD_REQUEST', 'INVALID_PRESCRIPTION_DRAFT', message);
	}
}
