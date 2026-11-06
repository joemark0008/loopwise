import type { ApiInputs, ApiOutputs } from '@/lib/api-types';

import {
	CashierDeskDocument,
	CashierShiftsDocument,
	CashierShiftXReadingDocument,
	CloseCashierShiftDocument,
	CreateInvoiceSeriesDocument,
	EncounterBillingDocument,
	InvoiceSeriesListDocument,
	IssueInvoiceDocument,
	LoadInvoiceChargesDocument,
	MyCashierShiftDocument,
	OpenCashierShiftDocument,
	PrintableInvoiceDocument,
	ProfessionalFeeReportDocument,
	RecordPaymentDocument,
	RecordPaymentsDocument,
	ReleaseProfessionalFeesDocument,
	SaveInvoiceDraftDocument,
	UpdateInvoiceSeriesDocument,
	VoidInvoiceDocument,
	VoidPaymentDocument,
} from '@/graphql/generated/graphql';
import { mutation, query, runMutation, runQuery } from '@/lib/apollo-procedures';

type Inputs = ApiInputs['billing'];
type Outputs = ApiOutputs['billing'];
type Key = keyof Inputs;

const path = (name: Key) => ['billing', name] as const;

/**
 * Billing (`apps/api/src/clinical/billing`): a visit's invoices, price list and charges; the cashier desk (shifts with
 * X / Z readings, split-tender payments, voids), the BIR invoice series, professional fees and the printed invoice.
 * Every mutation takes the Wise card's `wiseOrigin` in its input when a card confirms it. Writes return ids or the
 * row; pages read again through `invalidate`.
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
		loadCharges: mutation<Inputs['loadCharges'], Outputs['loadCharges']>(
			path('loadCharges'),
			async (input) => (await runMutation(LoadInvoiceChargesDocument, { input })).loadInvoiceCharges,
		),
		issue: mutation<Inputs['issue'], Outputs['issue']>(
			path('issue'),
			async (input) => (await runMutation(IssueInvoiceDocument, { input })).issueInvoice,
		),
		recordPayment: mutation<Inputs['recordPayment'], Outputs['recordPayment']>(
			path('recordPayment'),
			async (input) => (await runMutation(RecordPaymentDocument, { input })).recordPayment,
		),
		recordPayments: mutation<Inputs['recordPayments'], Outputs['recordPayments']>(
			path('recordPayments'),
			async (input) => (await runMutation(RecordPaymentsDocument, { input })).recordPayments,
		),
		voidPayment: mutation<Inputs['voidPayment'], Outputs['voidPayment']>(
			path('voidPayment'),
			async (input) => (await runMutation(VoidPaymentDocument, { input })).voidPayment,
		),
		void: mutation<Inputs['void'], Outputs['void']>(
			path('void'),
			async (input) => (await runMutation(VoidInvoiceDocument, { input })).voidInvoice,
		),
		print: query<Inputs['print'], Outputs['print']>(
			path('print'),
			async ({ id }) => (await runQuery(PrintableInvoiceDocument, { id })).printableInvoice,
		),
		desk: query<Inputs['desk'], Outputs['desk']>(
			path('desk'),
			async ({ date }) => (await runQuery(CashierDeskDocument, { date: date ?? null })).cashierDesk,
		),
		myShift: query<Inputs['myShift'], Outputs['myShift']>(
			path('myShift'),
			async () => (await runQuery(MyCashierShiftDocument, {})).myCashierShift ?? null,
		),
		shifts: query<Inputs['shifts'], Outputs['shifts']>(
			path('shifts'),
			async (input) => (await runQuery(CashierShiftsDocument, { input })).cashierShifts,
		),
		openShift: mutation<Inputs['openShift'], Outputs['openShift']>(
			path('openShift'),
			async (input) => (await runMutation(OpenCashierShiftDocument, { input })).openCashierShift,
		),
		xReading: mutation<Inputs['xReading'], Outputs['xReading']>(
			path('xReading'),
			async ({ shiftId }) => (await runMutation(CashierShiftXReadingDocument, { shiftId })).cashierShiftXReading,
		),
		closeShift: mutation<Inputs['closeShift'], Outputs['closeShift']>(
			path('closeShift'),
			async (input) => (await runMutation(CloseCashierShiftDocument, { input })).closeCashierShift,
		),
		series: query<Inputs['series'], Outputs['series']>(
			path('series'),
			async () => (await runQuery(InvoiceSeriesListDocument, {})).invoiceSeries,
		),
		createSeries: mutation<Inputs['createSeries'], Outputs['createSeries']>(
			path('createSeries'),
			async (input) => (await runMutation(CreateInvoiceSeriesDocument, { input })).createInvoiceSeries,
		),
		updateSeries: mutation<Inputs['updateSeries'], Outputs['updateSeries']>(
			path('updateSeries'),
			async (input) => (await runMutation(UpdateInvoiceSeriesDocument, { input })).updateInvoiceSeries,
		),
		feeReport: query<Inputs['feeReport'], Outputs['feeReport']>(
			path('feeReport'),
			async (input) => (await runQuery(ProfessionalFeeReportDocument, { input })).professionalFeeReport,
		),
		releaseFees: mutation<Inputs['releaseFees'], Outputs['releaseFees']>(
			path('releaseFees'),
			async (input) => (await runMutation(ReleaseProfessionalFeesDocument, { input })).releaseProfessionalFees,
		),
	},
	/** Every billing query (a visit's billing, the desk, shifts, series, fees): read again after any billing write. */
	invalidate: { queryKey: [['billing']] as const },
};
