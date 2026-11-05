import type { ApiInputs, ApiOutputs } from '@/lib/api-types';

import {
	ClinicEncountersDocument,
	CreateEncounterDocument,
	EncountersDocument,
	PatientOverviewDocument,
	TransitionEncounterDocument,
} from '@/graphql/generated/graphql';
import { mutation, query, runMutation, runQuery } from '@/lib/apollo-procedures';

type Inputs = ApiInputs['encounter'];
type Outputs = ApiOutputs['encounter'];

/** Encounters (`apps/api/src/clinical/encounters`): the chart, the clinic's queue, status moves, the Wise card. */
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
		/** A clinic's visits (Today's queue). Under `['encounter', 'list']`, so visit changes refresh it. */
		atClinic: query<Inputs['atClinic'], Outputs['atClinic']>(
			['encounter', 'list', 'atClinic'],
			async (input) => (await runQuery(ClinicEncountersDocument, { input })).clinicEncounters,
		),
		transition: mutation<Inputs['transition'], Outputs['transition']>(
			['encounter', 'transition'],
			async (input) => (await runMutation(TransitionEncounterDocument, { input })).transitionEncounter,
		),
	},
};
