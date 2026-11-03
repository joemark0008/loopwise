import type { ApiInputs, ApiOutputs } from '@/lib/api-types';

import { CancelWiseProposalDocument, WiseProposalOutcomesDocument } from '@/graphql/generated/graphql';
import { mutation, query, runMutation, runQuery } from '@/lib/apollo-procedures';

type Inputs = ApiInputs['wiseProposal'];
type Outputs = ApiOutputs['wiseProposal'];

/** How the Wise proposal cards of a chat ended (`apps/api/src/clinical/wise-proposals`), and Cancel on a card. */
export const wiseProposalApi = {
	wiseProposal: {
		outcomes: query<Inputs['outcomes'], Outputs['outcomes']>(
			['wiseProposal', 'outcomes'],
			async ({ chatId }) => (await runQuery(WiseProposalOutcomesDocument, { chatId })).wiseProposalOutcomes,
		),
		cancel: mutation<Inputs['cancel'], Outputs['cancel']>(
			['wiseProposal', 'cancel'],
			async (input) => (await runMutation(CancelWiseProposalDocument, { input })).cancelWiseProposal,
		),
	},
};
