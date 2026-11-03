import type { ApiInputs, ApiOutputs } from '@/lib/api-types';

import {
	CheckPatientDuplicatesDocument,
	LinkExistingPatientDocument,
	MyFacilitiesDocument,
	PatientChatDocument,
	PatientDocument,
	RegisterPatientDocument,
	SearchPatientsDocument,
} from '@/graphql/generated/graphql';
import { mutation, query, runMutation, runQuery } from '@/lib/apollo-procedures';

type Inputs = ApiInputs['patient'];
type Outputs = ApiOutputs['patient'];

/** Patient registration and lookup (`apps/api/src/clinical/patients`), shared by the patient pages and the Wise card. */
export const patientApi = {
	patient: {
		facilities: query<void, Outputs['facilities']>(
			['patient', 'facilities'],
			async () => (await runQuery(MyFacilitiesDocument, {})).myFacilities,
		),
		chat: query<Inputs['chat'], Outputs['chat']>(
			['patient', 'chat'],
			async ({ patientId }) => (await runQuery(PatientChatDocument, { patientId })).patientChat ?? null,
		),
		search: query<Inputs['search'], Outputs['search']>(
			['patient', 'search'],
			async (input) => (await runQuery(SearchPatientsDocument, { input })).searchPatients,
		),
		get: query<Inputs['get'], Outputs['get']>(
			['patient', 'get'],
			async ({ id }) => (await runQuery(PatientDocument, { id })).patient,
		),
		checkDuplicates: query<Inputs['checkDuplicates'], Outputs['checkDuplicates']>(
			['patient', 'checkDuplicates'],
			async (input) => (await runQuery(CheckPatientDuplicatesDocument, { input })).checkPatientDuplicates,
		),
		register: mutation<Inputs['register'], Outputs['register']>(
			['patient', 'register'],
			async (input) => (await runMutation(RegisterPatientDocument, { input })).registerPatient,
		),
		linkExisting: mutation<Inputs['linkExisting'], Outputs['linkExisting']>(
			['patient', 'linkExisting'],
			async (input) => (await runMutation(LinkExistingPatientDocument, { input })).linkExistingPatient,
		),
	},
};
