import { DomainError } from '../../common/errors/domain-error.js';

/** A PRC license number belongs to one practitioner (`practitioners.prc_license_no` is unique). */
export class PrcLicenseTakenError extends DomainError {
	constructor(prcLicenseNo: string) {
		super(
			'CONFLICT',
			'PRC_LICENSE_TAKEN',
			`PRC license ${prcLicenseNo} is already on another practitioner's profile.`,
			{ prcLicenseNo },
		);
	}
}

/**
 * Prescriptions, certificates and referrals are signed by a practitioner (their PRC license is printed on them): the
 * user needs a practitioner profile first (Settings → Account → Practitioner profile).
 */
export class PractitionerProfileRequiredError extends DomainError {
	constructor(document: string) {
		super(
			'BAD_REQUEST',
			'PRACTITIONER_PROFILE_REQUIRED',
			`Add your PRC license in Settings → Account (practitioner profile) before writing a ${document}.`,
		);
	}
}

/** A weekly session or a leave that can't be: end before start, an unknown day, a bad date. */
export class InvalidScheduleError extends DomainError {
	constructor(message: string) {
		super('BAD_REQUEST', 'INVALID_SCHEDULE', message);
	}
}
