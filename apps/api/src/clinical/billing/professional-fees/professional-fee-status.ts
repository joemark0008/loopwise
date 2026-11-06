import { InvalidStatusTransitionError } from '../../../common/errors/domain-error.js';
import type { PfStatus } from '../../../generated/prisma/enums.js';

/**
 * A doctor's fee: UNPAID → FOR_RELEASE → RELEASED (paid out, with a reference), or straight to RELEASED; CANCELLED when
 * its invoice is voided before release. RELEASED and CANCELLED are final.
 */
export const PF_TRANSITIONS: Readonly<Record<PfStatus, readonly PfStatus[]>> = {
	UNPAID: ['FOR_RELEASE', 'RELEASED', 'CANCELLED'],
	FOR_RELEASE: ['UNPAID', 'RELEASED', 'CANCELLED'],
	RELEASED: [],
	CANCELLED: [],
};

/** The statuses a fee may move to `to` from. */
export const pfStatusesInto = (to: PfStatus): PfStatus[] =>
	(Object.keys(PF_TRANSITIONS) as PfStatus[]).filter((from) => PF_TRANSITIONS[from].includes(to));

export function assertPfTransition(from: PfStatus, to: PfStatus): void {
	if (!PF_TRANSITIONS[from].includes(to)) {
		throw new InvalidStatusTransitionError('ProfessionalFee', from, to);
	}
}
