import { fieldErrors } from '@loopwise/shared/encounter-record';
import {
	computeInvoiceTotals,
	InvoiceDraftSchema,
	isScPwdEligible,
	PaymentDraftSchema,
	SplitPaymentSchema,
} from '@loopwise/shared/invoice';
import type {
	OtherDiscountType,
	PaymentMethod,
	ServiceCategory,
	StatutoryDiscountType,
	TaxType,
} from '@loopwise/shared/invoice';
import type {
	EncounterBillingFieldsFragment,
	InvoiceFieldsFragment,
	PaymentTenderInput,
	RecordPaymentInput,
	RecordPaymentsInput,
	SaveInvoiceDraftInput,
} from '@/graphql/generated/graphql';

/** One line of the invoice form, as typed. */
export interface InvoiceLineFormValues {
	/** The price list item, or '' for a free line. */
	serviceItemId: string;
	description: string;
	quantity: string;
	unitPrice: string;
	taxType: TaxType;
	/** The item's category ('' for a free line): decides the SC/PWD discount. */
	category: ServiceCategory | '';
	/** Whose fee the line is ('' for none). */
	practitionerId: string;
}

export interface InvoiceFormValues {
	lines: InvoiceLineFormValues[];
	discountType: StatutoryDiscountType | '';
	/** The patient's OSCA / PWD ID on file that was presented. */
	discountIdentificationId: string;
	/** Or its number as presented (a Wise card names the number). */
	discountIdNumber: string;
	otherDiscountType: OtherDiscountType | '';
	otherDiscountMode: 'percent' | 'amount';
	otherDiscountValue: string;
	otherDiscountApprovedById: string;
	/** '' or a rate such as '0.02'. */
	withholdingTaxRate: string;
}

/** One tender of a payment, as typed. */
export interface PaymentTenderFormValues {
	method: PaymentMethod;
	amount: string;
	tenderedAmount: string;
	referenceNo: string;
	bankName: string;
	checkDate: string;
}

/** The cashier's payment: one or several tenders (split tender). */
export interface PaymentFormValues {
	tenders: PaymentTenderFormValues[];
}

type PriceItem = EncounterBillingFieldsFragment['priceList'][number];
type Billing = EncounterBillingFieldsFragment;

export const emptyInvoiceLine = (): InvoiceLineFormValues => ({
	serviceItemId: '',
	description: '',
	quantity: '1',
	unitPrice: '',
	taxType: 'VAT_EXEMPT',
	category: '',
	practitionerId: '',
});

/** A line for a price list item, at the clinic's price. */
export const lineFromPriceItem = (item: PriceItem, quantity = '1'): InvoiceLineFormValues => ({
	serviceItemId: item.id,
	description: item.name,
	quantity,
	unitPrice: String(item.price),
	taxType: item.taxType,
	category: item.category,
	practitionerId: '',
});

/** The visit's invoice that is not void, if any (at most one). */
export const activeInvoice = (billing: Billing) =>
	billing.invoices.find((invoice) => invoice.status !== 'VOID') ?? null;

const NO_DISCOUNTS = {
	discountType: '',
	discountIdentificationId: '',
	discountIdNumber: '',
	otherDiscountType: '',
	otherDiscountMode: 'percent',
	otherDiscountValue: '',
	otherDiscountApprovedById: '',
	withholdingTaxRate: '',
} as const satisfies Omit<InvoiceFormValues, 'lines'>;

const categoryOf = (billing: Billing, serviceItemId: string | null | undefined): ServiceCategory | '' =>
	(serviceItemId && billing.priceList.find((item) => item.id === serviceItemId)?.category) || '';

/** The visit's charges ("Load charges") as form lines. */
export function chargeLines(billing: Billing): InvoiceLineFormValues[] {
	return billing.suggestedLines.map((line) => ({
		serviceItemId: line.serviceItemId ?? '',
		description: line.description,
		quantity: String(line.quantity),
		unitPrice: line.unitPrice ? String(line.unitPrice) : '',
		taxType: line.taxType,
		category: categoryOf(billing, line.serviceItemId),
		practitionerId: line.practitionerId ?? '',
	}));
}

/** The draft to edit, or a new invoice pre-filled with the visit's charges. */
export function invoiceFormFrom(billing: Billing): InvoiceFormValues {
	const draft = billing.invoices.find((invoice) => invoice.status === 'DRAFT');
	if (!draft) {
		const lines = chargeLines(billing);
		return { ...NO_DISCOUNTS, lines: lines.length > 0 ? lines : [emptyInvoiceLine()] };
	}
	const statutory = draft.discounts.find((discount) => isStatutory(discount.type));
	const other = draft.discounts.find((discount) => isOther(discount.type));
	return {
		lines: draft.lines.map((line) => ({
			serviceItemId: line.serviceItemId ?? '',
			description: line.description,
			quantity: String(line.quantity),
			unitPrice: String(line.unitPrice),
			taxType: line.taxType,
			category: line.category ?? '',
			practitionerId: line.practitionerId ?? '',
		})),
		discountType: statutory && isStatutory(statutory.type) ? statutory.type : '',
		discountIdentificationId: statutory?.identificationId ?? '',
		discountIdNumber: statutory?.identificationId ? '' : (statutory?.idNumber ?? ''),
		otherDiscountType: other && isOther(other.type) ? other.type : '',
		otherDiscountMode: other && other.rate === 0 ? 'amount' : 'percent',
		otherDiscountValue: other ? String(other.rate === 0 ? other.amount : round2(other.rate * 100)) : '',
		otherDiscountApprovedById: other?.approvedById ?? '',
		withholdingTaxRate: draft.withholdingTaxRate ? String(draft.withholdingTaxRate) : '',
	};
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const isStatutory = (type: string): type is StatutoryDiscountType => type === 'SENIOR_CITIZEN' || type === 'PWD';
const isOther = (type: string): type is OtherDiscountType =>
	type === 'EMPLOYEE' || type === 'PROMO' || type === 'SPECIAL';

/** The patient's ID on file for the discount (the first one), to pre-select it. */
export const identificationOnFile = (billing: Billing, type: StatutoryDiscountType | '') =>
	billing.discountIdentifications.find((identification) => identification.discountType === type) ?? null;

/** The ID number on file for the discount, to pre-fill a Wise card. */
export const idNumberOnFile = (billing: Billing, type: StatutoryDiscountType | '') =>
	identificationOnFile(billing, type)?.idNumber ?? '';

/** The values as the shared draft rules read them. */
function draftOf(values: InvoiceFormValues) {
	const other = values.otherDiscountType;
	return {
		lines: values.lines.map((line) => ({ ...line, practitionerId: line.practitionerId || undefined })),
		discountType: values.discountType,
		discountIdentificationId: values.discountType ? values.discountIdentificationId : '',
		discountIdNumber: values.discountType ? values.discountIdNumber : '',
		otherDiscountType: other,
		otherDiscountPercent: other && values.otherDiscountMode === 'percent' ? values.otherDiscountValue : '',
		otherDiscountAmount: other && values.otherDiscountMode === 'amount' ? values.otherDiscountValue : '',
		otherDiscountApprovedById: other ? values.otherDiscountApprovedById : '',
		withholdingTaxRate: values.withholdingTaxRate,
	};
}

export const validateInvoiceForm = (values: InvoiceFormValues) => fieldErrors(InvoiceDraftSchema, draftOf(values));

/** The totals as you type (the shared rules); the API computes them again from the lines. */
export function invoiceFormTotals(values: InvoiceFormValues, vatRegistered = true) {
	const value = Number(values.otherDiscountValue) || 0;
	return computeInvoiceTotals(
		values.lines.map((line) => ({
			quantity: Number(line.quantity) || 0,
			unitPrice: Number(line.unitPrice) || 0,
			taxType: line.taxType,
			scPwdEligible: isScPwdEligible(line.category || null),
		})),
		{
			vatRegistered,
			statutoryDiscount: values.discountType || null,
			otherDiscount: values.otherDiscountType
				? values.otherDiscountMode === 'percent'
					? { rate: value / 100 }
					: { amount: value }
				: null,
			withholdingTaxRate: Number(values.withholdingTaxRate) || 0,
		},
	);
}

export function toSaveInvoiceDraftInput(
	encounterId: string,
	values: InvoiceFormValues,
	expectedVersion: number | null,
): SaveInvoiceDraftInput {
	const other = values.otherDiscountType || null;
	return {
		encounterId,
		lines: values.lines.map((line) => ({
			serviceItemId: line.serviceItemId || null,
			description: line.description.trim(),
			quantity: Number(line.quantity),
			unitPrice: Number(line.unitPrice),
			taxType: line.taxType,
			practitionerId: line.practitionerId || null,
		})),
		discountType: values.discountType || null,
		discountIdentificationId: (values.discountType && values.discountIdentificationId) || null,
		discountIdNumber:
			values.discountType && !values.discountIdentificationId ? values.discountIdNumber.trim() || null : null,
		otherDiscountType: other,
		otherDiscountPercent:
			other && values.otherDiscountMode === 'percent' ? Number(values.otherDiscountValue) : null,
		otherDiscountAmount: other && values.otherDiscountMode === 'amount' ? Number(values.otherDiscountValue) : null,
		otherDiscountApprovedById: other ? values.otherDiscountApprovedById || null : null,
		withholdingTaxRate: Number(values.withholdingTaxRate) || null,
		expectedVersion,
	};
}

export const emptyTender = (method: PaymentMethod = 'CASH', amount = ''): PaymentTenderFormValues => ({
	method,
	amount,
	tenderedAmount: '',
	referenceNo: '',
	bankName: '',
	checkDate: '',
});

/** A payment of the whole balance in cash, to start from. */
export const paymentFormFrom = (invoice: InvoiceFieldsFragment, method: PaymentMethod = 'CASH'): PaymentFormValues => ({
	tenders: [emptyTender(method, String(invoice.balance))],
});

/** The centavos still to tender after the tenders typed so far. */
export function remainingToTender(values: PaymentFormValues, balance: number): number {
	const typed = values.tenders.reduce((sum, tender) => sum + Math.round((Number(tender.amount) || 0) * 100), 0);
	return Math.max(0, Math.round(balance * 100) - typed) / 100;
}

export function validatePaymentForm(values: PaymentFormValues, balance: number): Record<string, string> {
	const errors = fieldErrors(SplitPaymentSchema, values.tenders);
	values.tenders.forEach((tender, index) => {
		for (const [key, message] of Object.entries(fieldErrors(PaymentDraftSchema, tender))) {
			errors[`tenders.${index}.${key}`] ??= message;
		}
	});
	const total = values.tenders.reduce((sum, tender) => sum + Math.round((Number(tender.amount) || 0) * 100), 0);
	if (total > Math.round(balance * 100)) {
		errors.total = 'The tenders add up to more than the balance.';
	}
	return errors;
}

/** One tender's problems, by field (a Wise card's single payment). */
export function validateTender(tender: PaymentTenderFormValues, balance: number): Record<string, string> {
	const errors = fieldErrors(PaymentDraftSchema, tender);
	if (!errors.amount && Number(tender.amount) > balance) {
		errors.amount = 'The amount is more than the balance.';
	}
	return errors;
}

const toTender = (tender: PaymentTenderFormValues): PaymentTenderInput => ({
	method: tender.method,
	amount: Number(tender.amount),
	tenderedAmount: tender.method === 'CASH' && tender.tenderedAmount ? Number(tender.tenderedAmount) : null,
	referenceNo: tender.referenceNo.trim() || null,
	bankName: tender.method === 'CHECK' ? tender.bankName.trim() || null : null,
	checkDate: tender.method === 'CHECK' ? tender.checkDate || null : null,
});

export function toRecordPaymentsInput(invoice: InvoiceFieldsFragment, values: PaymentFormValues): RecordPaymentsInput {
	return { invoiceId: invoice.id, tenders: values.tenders.map(toTender), expectedVersion: invoice.version };
}

/** One tender, as a Wise card records it. */
export function toRecordPaymentInput(
	invoice: InvoiceFieldsFragment,
	tender: PaymentTenderFormValues,
): RecordPaymentInput {
	return { invoiceId: invoice.id, ...toTender(tender), expectedVersion: invoice.version };
}
