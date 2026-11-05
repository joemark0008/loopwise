import type { ApiInputs, ApiOutputs } from '@/lib/api-types';

import { PatientResultsDocument, ResultsToReviewDocument, ReviewResultDocument } from '@/graphql/generated/graphql';
import { mutation, query, runMutation, runQuery } from '@/lib/apollo-procedures';

type Inputs = ApiInputs['result'];
type Outputs = ApiOutputs['result'];

/** Released lab and imaging results (`apps/api/src/clinical/diagnostics/results`): the inbox and the Results tab. */
export const resultApi = {
	result: {
		toReview: query<Inputs['toReview'], Outputs['toReview']>(
			['result', 'toReview'],
			async () => (await runQuery(ResultsToReviewDocument, {})).resultsToReview,
		),
		forPatient: query<Inputs['forPatient'], Outputs['forPatient']>(
			['result', 'forPatient'],
			async ({ patientId }) => (await runQuery(PatientResultsDocument, { patientId })).patientResults,
		),
		review: mutation<Inputs['review'], Outputs['review']>(
			['result', 'review'],
			async (input) => (await runMutation(ReviewResultDocument, { input })).reviewResult,
		),
	},
};
