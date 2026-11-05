import { InvalidStatusTransitionError } from '../../../common/errors/domain-error.js';
import type { ReferralStatus } from '../../../generated/prisma/enums.js';

/**
 * The referral's status machine (`referral_status`): SENT when written, the receiving side ACCEPTS or DECLINES it and
 * marks it COMPLETED; the referring clinic may CANCEL it until it is completed or declined. DRAFT is unused for now.
 */
export const REFERRAL_TRANSITIONS: Record<ReferralStatus, readonly ReferralStatus[]> = {
	DRAFT: ['SENT', 'CANCELLED'],
	SENT: ['ACCEPTED', 'DECLINED', 'CANCELLED'],
	ACCEPTED: ['COMPLETED', 'CANCELLED'],
	COMPLETED: [],
	DECLINED: [],
	CANCELLED: [],
};

/** The new status, or INVALID_STATUS_TRANSITION when the machine forbids the move. */
export function transitionReferralStatus(from: ReferralStatus, to: ReferralStatus): ReferralStatus {
	if (!REFERRAL_TRANSITIONS[from].includes(to)) {
		throw new InvalidStatusTransitionError('Referral', from, to);
	}
	return to;
}
