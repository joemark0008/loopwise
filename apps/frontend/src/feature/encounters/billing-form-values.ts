import { fieldErrors } from '@loopwise/shared/encounter-record';
import { computeInvoiceTotals, InvoiceDraftSchema, PaymentDraftSchema } from '@loopwise/shared/invoice';
import type { PaymentMethod, StatutoryDiscountType, TaxType } from '@loopwise/shared/invoice';
import type {
	EncounterBillingFieldsFragment,
	InvoiceFieldsFragment,
	RecordPaymentInput,
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
}

export interface InvoiceFormValues {
	lines: InvoiceLineFormValues[];
	discountType: StatutoryDiscountType | '';
	/** The OSCA / PWD ID number presented. */
	discountIdNumber: string;
}

export interface PaymentFormValues {
	method: PaymentMethod;
	amount: string;
	tenderedAmount: string;
	referenceNo: string;
}

type PriceItem = EncounterBillingFieldsFragment['priceList'][number];

export const emptyInvoiceLine = (): InvoiceLineFormValues => ({
	serviceItemId: '',
	description: '',
	quantity: '1',
	unitPrice: '',
	taxType: 'VAT_EXEMPT',
});

/** A line for a price list item, at the clinic's price. */
export const lineFromPriceItem = (item: PriceItem, quantity = '1'): InvoiceLineFormValues => ({
	serviceItemId: item.id,
	description: item.name,
	quantity,
	unitPrice: String(item.price),
	taxType: item.taxType,
});

/** The visit's invoice that is not void, if any (at most one). */
export const activeInvoice = (billing: EncounterBillingFieldsFragment) =>
	billing.invoices.find((invoice) => invoice.status !== 'VOID') ?? null;

/** The draft to edit, or a new invoice pre-filled with the consultation and the tests ordered. */
export function invoiceFormFrom(billing: EncounterBillingFieldsFragment): InvoiceFormValues {
	const draft = billing.invoices.find((invoice) => invoice.status === 'DRAFT');
	if (draft) {
		const discount = draft.discounts[0];
		return {
			lines: draft.lines.map((line) => ({
				serviceItemId: line.serviceItemId ?? '',
				description: line.description,
				quantity: String(line.quantity),
				unitPrice: String(line.unitPrice),
				taxType: line.taxType,
			})),
			discountType: discount && isStatutory(discount.type) ? discount.type : '',
			discountIdNumber: discount?.idNumber ?? '',
		};
	}
	const lines = billing.suggestedLines.map((line) => ({
		serviceItemId: line.serviceItemId ?? '',
		description: line.description,
		quantity: String(line.quantity),
		unitPrice: line.unitPrice ? String(line.unitPrice) : '',
		taxType: line.taxType,
	}));
	return { lines: lines.length > 0 ? lines : [emptyInvoiceLine()], discountType: '', discountIdNumber: '' };
}

const isStatutory = (type: string): type is StatutoryDiscountType => type === 'SENIOR_CITIZEN' || type === 'PWD';

/** The patient's ID number on file for the discount, to pre-fill the field. */
export const idNumberOnFile = (billing: EncounterBillingFieldsFragment, type: StatutoryDiscountType | '') =>
	billing.discountIdentifications.find((identification) => identification.discountType === type)?.idNumber ?? '';

export const validateInvoiceForm = (values: InvoiceFormValues) => fieldErrors(InvoiceDraftSchema, values);

/** The totals as you type (the shared rules); the API computes them again from the lines. */
export function invoiceFormTotals(values: InvoiceFormValues) {
	return computeInvoiceTotals(
		values.lines.map((line) => ({
			quantity: Number(line.quantity) || 0,
			unitPrice: Number(line.unitPrice) || 0,
			taxType: line.taxType,
		})),
		values.discountType || null,
	);
}

export function toSaveInvoiceDraftInput(
	encounterId: string,
	values: InvoiceFormValues,
	expectedVersion: number | null,
): SaveInvoiceDraftInput {
	return {
		encounterId,
		lines: values.lines.map((line) => ({
			serviceItemId: line.serviceItemId || null,
			description: line.description.trim(),
			quantity: Number(line.quantity),
			unitPrice: Number(line.unitPrice),
			taxType: line.taxType,
		})),
		discountType: values.discountType || null,
		discountIdNumber: values.discountType ? values.discountIdNumber.trim() : null,
		expectedVersion,
	};
}

/** A payment of the whole balance in cash, to start from. */
export const paymentFormFrom = (invoice: InvoiceFieldsFragment, method: PaymentMethod = 'CASH'): PaymentFormValues => ({
	method,
	amount: String(invoice.balance),
	tenderedAmount: '',
	referenceNo: '',
});

export function validatePaymentForm(values: PaymentFormValues, balance: number): Record<string, string> {
	const errors = fieldErrors(PaymentDraftSchema, values);
	if (!errors.amount && Number(values.amount) > balance) {
		errors.amount = 'The amount is more than the balance.';
	}
	return errors;
}

export function toRecordPaymentInput(invoice: InvoiceFieldsFragment, values: PaymentFormValues): RecordPaymentInput {
	return {
		invoiceId: invoice.id,
		method: values.method,
		amount: Number(values.amount),
		tenderedAmount: values.method === 'CASH' && values.tenderedAmount ? Number(values.tenderedAmount) : null,
		referenceNo: values.referenceNo.trim(),
		expectedVersion: invoice.version,
	};
}
