import type { ApiInputs, ApiOutputs } from '@/lib/api-types';

import {
	CancelDiagnosticOrderDocument,
	CreateDiagnosticOrderDocument,
	DiagnosticTestsDocument,
	EncounterDiagnosticOrdersDocument,
	EnterDiagnosticResultDocument,
	LabWorklistCountsDocument,
	LabWorklistDocument,
	MarkSpecimenCollectedDocument,
	ReleaseDiagnosticResultDocument,
	StartDiagnosticOrderItemDocument,
} from '@/graphql/generated/graphql';
import { mutation, query, runMutation, runQuery } from '@/lib/apollo-procedures';

type Inputs = ApiInputs['order'];
type Outputs = ApiOutputs['order'];

/**
 * Diagnostics (`apps/api/src/clinical/diagnostics`): the organization's test catalog, a visit's lab and imaging
 * requests, and the clinic's lab worklist (collect, start, enter results, release). Every worklist step is under
 * `['order', 'lab']`, so it refreshes the tabs and their counts.
 */
export const ordersApi = {
	order: {
		tests: query<Inputs['tests'], Outputs['tests']>(
			['order', 'tests'],
			async () => (await runQuery(DiagnosticTestsDocument, {})).diagnosticTests,
		),
		forEncounter: query<Inputs['forEncounter'], Outputs['forEncounter']>(
			['order', 'encounter'],
			async ({ encounterId }) =>
				(await runQuery(EncounterDiagnosticOrdersDocument, { encounterId })).encounterDiagnosticOrders,
		),
		create: mutation<Inputs['create'], Outputs['create']>(
			['order', 'create'],
			async (input) => (await runMutation(CreateDiagnosticOrderDocument, { input })).createDiagnosticOrder,
		),
		cancel: mutation<Inputs['cancel'], Outputs['cancel']>(
			['order', 'cancel'],
			async (input) => (await runMutation(CancelDiagnosticOrderDocument, { input })).cancelDiagnosticOrder,
		),
		worklist: query<Inputs['worklist'], Outputs['worklist']>(
			['order', 'lab'],
			async ({ statuses }) => (await runQuery(LabWorklistDocument, { statuses })).labWorklist,
		),
		worklistCounts: query<Inputs['worklistCounts'], Outputs['worklistCounts']>(
			['order', 'lab', 'counts'],
			async () => (await runQuery(LabWorklistCountsDocument, {})).labWorklistCounts,
		),
		collect: mutation<Inputs['collect'], Outputs['collect']>(
			['order', 'collect'],
			async (input) => (await runMutation(MarkSpecimenCollectedDocument, { input })).markSpecimenCollected,
		),
		start: mutation<Inputs['start'], Outputs['start']>(
			['order', 'start'],
			async (input) => (await runMutation(StartDiagnosticOrderItemDocument, { input })).startDiagnosticOrderItem,
		),
		enterResult: mutation<Inputs['enterResult'], Outputs['enterResult']>(
			['order', 'enterResult'],
			async (input) => (await runMutation(EnterDiagnosticResultDocument, { input })).enterDiagnosticResult,
		),
		release: mutation<Inputs['release'], Outputs['release']>(
			['order', 'release'],
			async (input) => (await runMutation(ReleaseDiagnosticResultDocument, { input })).releaseDiagnosticResult,
		),
	},
};
