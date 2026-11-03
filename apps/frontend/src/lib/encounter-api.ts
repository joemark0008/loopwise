import type { ApiInputs, ApiOutputs } from '@/lib/api-types';

import { CreateEncounterDocument, EncountersDocument, PatientOverviewDocument } from '@/graphql/generated/graphql';
import { mutation, query, runMutation, runQuery } from '@/lib/apollo-procedures';

type Inputs = ApiInputs['encounter'];
type Outputs = ApiOutputs['encounter'];

/** A patient's encounters (`apps/api/src/clinical/encounters`), for the chart and the Wise encounter card. */
export const encounterApi = {
	encounter: {
		list: query<Inputs['list'], Outputs['list']>(
			['encounter', 'list'],
			async ({ patientId }) => (await runQuery(EncountersDocument, { patientId })).encounters,
		),
		/**
		 * The chart's overview. Its key sits under `['encounter', 'list']`, so everything that refreshes a patient's
		 * encounters (a new visit, a record edit, a Wise card) refreshes the overview too.
		 */
		overview: query<Inputs['overview'], Outputs['overview']>(
			['encounter', 'list', 'overview'],
			async ({ patientId }) => (await runQuery(PatientOverviewDocument, { patientId })).patientOverview,
		),
		create: mutation<Inputs['create'], Outputs['create']>(
			['encounter', 'create'],
			async (input) => (await runMutation(CreateEncounterDocument, { input })).createEncounter,
		),
	},
};
