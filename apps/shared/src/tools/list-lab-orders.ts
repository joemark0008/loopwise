import z from 'zod/v3';

export const MAX_ORDERS = 30;

/** The worklist steps still to do: mirrors the API's `DiagnosticOrderStatus` values before release. */
export const LAB_WORKLIST_STATUSES = ['REQUESTED', 'PAID', 'SPECIMEN_COLLECTED', 'IN_PROGRESS', 'RESULTED'] as const;
export type LabWorklistStatus = (typeof LAB_WORKLIST_STATUSES)[number];

export const description = [
	"For the clinic's lab staff (medtech, radtech): list the tests on this clinic's lab worklist, read as them, STAT",
	'first then oldest: to collect (requested, paid), collected, in progress, and resulted (waiting for release). Each',
	'comes with its item id, order number, test, priority, status, patient and requesting doctor. To mark one collected,',
	'start it, release its result or cancel it, call propose_lab_order_step with its item id. Results are entered on',
	'the worklist page. Never invent an order.',
].join(' ');

export const InputSchema = z.object({
	status: z.enum(LAB_WORKLIST_STATUSES).optional().describe('Only this step, if the user asked; else all.'),
});

export const OrderSchema = z.object({
	/** The order item: one test of the order. */
	id: z.string(),
	orderNo: z.string(),
	test: z.string(),
	category: z.string(),
	priority: z.enum(['ROUTINE', 'URGENT', 'STAT']),
	status: z.string(),
	clinicalInfo: z.string().nullable(),
	accessionNo: z.string().nullable(),
	orderedAt: z.string(),
	patient: z.object({ name: z.string(), patientNo: z.string(), birthDate: z.string(), sex: z.string() }),
	requestedBy: z.string(),
});

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	orders: z.array(OrderSchema),
	truncated: z.boolean(),
});

export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;
export type Order = z.infer<typeof OrderSchema>;
