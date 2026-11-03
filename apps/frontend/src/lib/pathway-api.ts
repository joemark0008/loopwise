import type { ApiInputs, ApiOutputs } from '@/lib/api-types';

import { PathwaysDocument, ResultEvaluationDocument } from '@/graphql/generated/graphql';
import { query, runQuery } from '@/lib/apollo-procedures';

type Inputs = ApiInputs['pathway'];
type Outputs = ApiOutputs['pathway'];

/** The clinical pathways and the rules engine's evaluations (`apps/api/src/clinical/pathways`), read-only. */
export const pathwayApi = {
	pathway: {
		list: query<void, Outputs['list']>(
			['pathway', 'list'],
			async () => (await runQuery(PathwaysDocument, {})).pathways,
		),
		evaluation: query<Inputs['evaluation'], Outputs['evaluation']>(
			['pathway', 'evaluation'],
			async ({ resultId }) => (await runQuery(ResultEvaluationDocument, { resultId })).resultEvaluation ?? null,
		),
	},
};
