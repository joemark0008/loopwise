import type { ApiInputs, ApiOutputs } from '@/lib/api-types';

import {
	AcceptReferralDocument,
	CompleteReferralDocument,
	DeclineReferralDocument,
	FollowUpsDocument,
	ReferralLetterDocument,
	ReferralsDocument,
} from '@/graphql/generated/graphql';
import { mutation, query, runMutation, runQuery } from '@/lib/apollo-procedures';

type FollowUpInputs = ApiInputs['followUp'];
type FollowUpOutputs = ApiOutputs['followUp'];
type ReferralInputs = ApiInputs['referral'];
type ReferralOutputs = ApiOutputs['referral'];

/**
 * Follow-ups (`apps/api/src/clinical/follow-ups`) and referral answers and letters
 * (`apps/api/src/clinical/documents/referrals`). Reads are under `['followUp', …]` and `['referral', …]`, so one
 * invalidation each (`followUpApi.invalidate`, `referralApi.invalidate`) refreshes the lists.
 */
export const followUpApi = {
	list: query<FollowUpInputs['list'], FollowUpOutputs['list']>(
		['followUp', 'list'],
		async (input) => (await runQuery(FollowUpsDocument, { input })).followUps,
	),
	invalidate: { queryKey: [['followUp']] as const },
};

export const referralApi = {
	list: query<ReferralInputs['list'], ReferralOutputs['list']>(
		['referral', 'list'],
		async (input) => (await runQuery(ReferralsDocument, { input })).referrals,
	),
	letter: query<ReferralInputs['letter'], ReferralOutputs['letter']>(
		['referral', 'letter'],
		async ({ id }) => (await runQuery(ReferralLetterDocument, { id })).referralLetter,
	),
	accept: mutation<ReferralInputs['accept'], ReferralOutputs['accept']>(
		['referral', 'accept'],
		async (input) => (await runMutation(AcceptReferralDocument, { input })).acceptReferral,
	),
	decline: mutation<ReferralInputs['decline'], ReferralOutputs['decline']>(
		['referral', 'decline'],
		async (input) => (await runMutation(DeclineReferralDocument, { input })).declineReferral,
	),
	complete: mutation<ReferralInputs['complete'], ReferralOutputs['complete']>(
		['referral', 'complete'],
		async (input) => (await runMutation(CompleteReferralDocument, { input })).completeReferral,
	),
	invalidate: { queryKey: [['referral']] as const },
};
