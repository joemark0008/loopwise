import z from 'zod/v3';

export const BILLING_VIEWS = ['collections', 'open_invoices', 'shift'] as const;
export type BillingView = (typeof BILLING_VIEWS)[number];

export const description = [
	"The cashier desk at this chat's clinic, read as the user and audited. view=collections: a day's posted payments by",
	'method (cash, GCash, Maya, cards …) and the total (billing desk and admins only). view=open_invoices: drafts and',
	"issued invoices with a balance, of this chat's patient (or patientId), else the clinic's oldest first.",
	"view=shift: the user's open cashier shift (opening cash, collected by method, expected cash in the drawer).",
	'Taking payments, issuing, voiding and closing a shift are done on the cashier pages, never from chat.',
].join(' ');

export const InputSchema = z.object({
	view: z.enum(BILLING_VIEWS),
	date: z.string().optional().describe('For collections: YYYY-MM-DD (Manila); default today.'),
	patientId: z.string().optional().describe("For open_invoices: a patient; default this chart chat's patient."),
});

export const MethodTotalSchema = z.object({ method: z.string(), count: z.number(), amount: z.number() });

export const OpenInvoiceSchema = z.object({
	invoiceNo: z.string().nullable(),
	status: z.string(),
	buyerName: z.string(),
	netAmount: z.number(),
	balance: z.number(),
	createdAt: z.string(),
	patientId: z.string().nullable(),
	encounterId: z.string().nullable(),
});

export const ShiftSchema = z.object({
	openedAt: z.string(),
	openingCash: z.number(),
	byMethod: z.array(MethodTotalSchema),
	totalCollected: z.number(),
	cashCollected: z.number(),
	expectedCash: z.number(),
	paymentCount: z.number(),
});

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	view: z.enum(BILLING_VIEWS),
	clinicName: z.string(),
	date: z.string(),
	/** Amounts in pesos. */
	collections: z.array(MethodTotalSchema).optional(),
	totalCollected: z.number().optional(),
	openInvoices: z.array(OpenInvoiceSchema).optional(),
	/** Null when the user has no open shift. */
	shift: ShiftSchema.nullable().optional(),
});

export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;
