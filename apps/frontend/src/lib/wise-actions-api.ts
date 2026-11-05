import type { UpdatePatientInput, WiseOriginInput, WisePatientContactQuery } from '@/graphql/generated/graphql';

import {
	UpdatePatientDocument,
	WiseIssueMedicalCertificateDocument,
	WiseIssuePrescriptionDocument,
	WisePatientContactDocument,
	WiseSaveReportToChartDocument,
} from '@/graphql/generated/graphql';
import { mutation, query, runMutation, runQuery } from '@/lib/apollo-procedures';

type WithOrigin<T> = T & { wiseOrigin: WiseOriginInput };

/**
 * What the Wise action cards need beyond the record modules (`@loopwise/shared/wise-actions`): a few reads, and the
 * mutations whose arguments are positional, called with the card's `wiseOrigin`. Mutations with an input type use the
 * record module's own call (`encounterRecordApi`, `resultApi`, `ordersApi`) with `wiseOrigin` in the input.
 */
export const wiseActionsApi = {
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
	saveReportToChart: mutation<WithOrigin<{ chatId: string; toolCallId: string }>, { id: string }>(
		['wiseActions', 'saveReportToChart'],
		async (variables) => (await runMutation(WiseSaveReportToChartDocument, variables)).saveReportToChart,
	),
	updatePatient: mutation<UpdatePatientInput, { id: string }>(
		['wiseActions', 'updatePatient'],
		async (input) => (await runMutation(UpdatePatientDocument, { input })).updatePatient,
	),
};
