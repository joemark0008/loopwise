import type {
	UpdatePatientInput,
	WiseOriginInput,
	WisePatientContactQuery,
	WiseResultEvaluationQuery,
} from '@/graphql/generated/graphql';

import {
	UpdatePatientDocument,
	WiseAcceptOrderDocument,
	WiseFinalizeEncounterBillDocument,
	WiseIssueMedicalCertificateDocument,
	WiseIssuePrescriptionDocument,
	WiseMarkOrderCollectedDocument,
	WisePatientContactDocument,
	WiseResultEvaluationDocument,
	WiseSaveReportToChartDocument,
} from '@/graphql/generated/graphql';
import { mutation, query, runMutation, runQuery } from '@/lib/apollo-procedures';

type WithOrigin<T> = T & { wiseOrigin: WiseOriginInput };

/**
 * What the Wise action cards need beyond the record modules (`@loopwise/shared/wise-actions`): a few reads, and the
 * mutations whose arguments are positional, called with the card's `wiseOrigin`. Mutations with an input type use the
 * record module's own call (`encounterRecordApi`, `resultApi`, `orderApi`) with `wiseOrigin` in the input.
 */
export const wiseActionsApi = {
	/** The rules engine's evaluation of a result (`resultEvaluation`), or null. */
	resultEvaluation: query<{ resultId: string }, WiseResultEvaluationQuery['resultEvaluation']>(
		['wiseActions', 'resultEvaluation'],
		async ({ resultId }) => (await runQuery(WiseResultEvaluationDocument, { resultId })).resultEvaluation,
	),
	patientContact: query<{ id: string }, WisePatientContactQuery['patient']>(
		['wiseActions', 'patientContact'],
		async ({ id }) => (await runQuery(WisePatientContactDocument, { id })).patient,
	),
	issuePrescription: mutation<WithOrigin<{ id: string }>, { id: string }>(
		['wiseActions', 'issuePrescription'],
		async (variables) => (await runMutation(WiseIssuePrescriptionDocument, variables)).issuePrescription,
	),
	issueCertificate: mutation<WithOrigin<{ id: string }>, { id: string }>(
		['wiseActions', 'issueCertificate'],
		async (variables) =>
			(await runMutation(WiseIssueMedicalCertificateDocument, variables)).issueMedicalCertificate,
	),
	finalizeBill: mutation<WithOrigin<{ id: string }>, { id: string }>(
		['wiseActions', 'finalizeBill'],
		async (variables) => (await runMutation(WiseFinalizeEncounterBillDocument, variables)).finalizeEncounterBill,
	),
	acceptOrder: mutation<WithOrigin<{ orderId: string }>, { id: string }>(
		['wiseActions', 'acceptOrder'],
		async (variables) => (await runMutation(WiseAcceptOrderDocument, variables)).acceptOrder,
	),
	markOrderCollected: mutation<WithOrigin<{ orderId: string }>, { id: string }>(
		['wiseActions', 'markOrderCollected'],
		async (variables) => (await runMutation(WiseMarkOrderCollectedDocument, variables)).markOrderCollected,
	),
	saveReportToChart: mutation<WithOrigin<{ chatId: string; toolCallId: string }>, { id: string }>(
		['wiseActions', 'saveReportToChart'],
		async (variables) => (await runMutation(WiseSaveReportToChartDocument, variables)).saveReportToChart,
	),
	updatePatient: mutation<UpdatePatientInput, { id: string }>(
		['wiseActions', 'updatePatient'],
		async (input) => (await runMutation(UpdatePatientDocument, { input })).updatePatient,
	),
};
