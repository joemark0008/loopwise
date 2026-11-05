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

/** A user signs in as one practitioner at most (`practitioners.user_id` is unique). */
export class PractitionerUserTakenError extends DomainError {
	constructor() {
		super('CONFLICT', 'PRACTITIONER_USER_TAKEN', 'This user already has a practitioner profile.');
	}
}

/** A practitioner's sign-in must be a user of the clinic (a role there). */
export class PractitionerUserNotAtClinicError extends DomainError {
	constructor() {
		super(
			'BAD_REQUEST',
			'PRACTITIONER_USER_NOT_AT_CLINIC',
			'Give the user a role at this clinic first (Settings → Clinic → Staff).',
		);
	}
}

/** A practitioner is in one place at a time: their weekly sessions on a day don't overlap, at any clinic. */
export class ScheduleOverlapError extends DomainError {
	constructor(dayOfWeek: number, startTime: string, endTime: string) {
		super(
			'CONFLICT',
			'SCHEDULE_OVERLAP',
			`The practitioner already holds clinic from ${startTime} to ${endTime} that day.`,
			{ dayOfWeek, startTime, endTime },
		);
	}
}

/** A weekly session or a leave that can't be: end before start, an unknown day, a bad date. */
export class InvalidScheduleError extends DomainError {
	constructor(message: string) {
		super('BAD_REQUEST', 'INVALID_SCHEDULE', message);
	}
}
