import { describe, expect, it } from 'vitest';

import { InvalidStatusTransitionError } from '../../../common/errors/domain-error.js';
import { transitionReferralStatus } from './referral-status.js';

describe('transitionReferralStatus', () => {
	it('lets a sent referral be accepted, declined or cancelled, and an accepted one completed', () => {
		expect(transitionReferralStatus('SENT', 'ACCEPTED')).toBe('ACCEPTED');
		expect(transitionReferralStatus('SENT', 'CANCELLED')).toBe('CANCELLED');
		expect(transitionReferralStatus('ACCEPTED', 'COMPLETED')).toBe('COMPLETED');
	});

	it('keeps completed, declined and cancelled referrals as they are', () => {
		for (const from of ['COMPLETED', 'DECLINED', 'CANCELLED'] as const) {
			expect(() => transitionReferralStatus(from, 'CANCELLED')).toThrow(InvalidStatusTransitionError);
		}
		expect(() => transitionReferralStatus('SENT', 'COMPLETED')).toThrow(InvalidStatusTransitionError);
	});
});
