import { DomainError } from '../../common/errors/domain-error.js';

/** The follow-up list is for doctors (their own), the front desk and the clinic's admins. */
export class FollowUpsAccessError extends DomainError {
	constructor() {
		super(
			'FORBIDDEN',
			'FOLLOW_UPS_ACCESS',
			"The follow-up list is for the clinic's doctors, front desk and admins.",
		);
	}
}
