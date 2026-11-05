import type { ApiInputs, ApiOutputs } from '@/lib/api-types';

import {
	EncounterBillingDocument,
	IssueInvoiceDocument,
	RecordPaymentDocument,
	SaveInvoiceDraftDocument,
	VoidInvoiceDocument,
} from '@/graphql/generated/graphql';
import { mutation, query, runMutation, runQuery } from '@/lib/apollo-procedures';

type Inputs = ApiInputs['billing'];
type Outputs = ApiOutputs['billing'];
type Key = keyof Inputs;

const path = (name: Key) => ['billing', name] as const;

/**
 * Billing (`apps/api/src/clinical/billing`): a visit's invoices, price list and suggested lines, and the cashier desk's
 * steps (draft, issue, payment, void). Every mutation takes the Wise card's `wiseOrigin` in its input when a card
 * confirms it. Writes return ids; the billing tab reads `get` again.
 */
export const billingApi = {
	billing: {
		get: query<Inputs['get'], Outputs['get']>(
			path('get'),
			async ({ encounterId }) => (await runQuery(EncounterBillingDocument, { encounterId })).encounterBilling,
		),
		saveDraft: mutation<Inputs['saveDraft'], Outputs['saveDraft']>(
			path('saveDraft'),
			async (input) => (await runMutation(SaveInvoiceDraftDocument, { input })).saveInvoiceDraft,
		),
		issue: mutation<Inputs['issue'], Outputs['issue']>(
			path('issue'),
			async (input) => (await runMutation(IssueInvoiceDocument, { input })).issueInvoice,
		),
		recordPayment: mutation<Inputs['recordPayment'], Outputs['recordPayment']>(
			path('recordPayment'),
			async (input) => (await runMutation(RecordPaymentDocument, { input })).recordPayment,
		),
		void: mutation<Inputs['void'], Outputs['void']>(
			path('void'),
			async (input) => (await runMutation(VoidInvoiceDocument, { input })).voidInvoice,
		),
	},
};
