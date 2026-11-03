import z from 'zod/v3';

export const MAX_ORDERS = 30;

export const LAB_WORKLIST_STATUSES = ['sent', 'accepted', 'collected'] as const;

export const description = [
	"For lab and imaging staff: list the orders sent to the user's facilities, read as them, STAT first then oldest:",
	'incoming (sent), accepted and collected. Each comes with its id, test, priority, patient and ordering doctor. To',
	'accept, mark collected or reject one, call propose_lab_order_step with its id. Never invent an order.',
].join(' ');

export const InputSchema = z.object({
	status: z.enum(LAB_WORKLIST_STATUSES).optional().describe('Only this worklist tab, if the user asked; else all.'),
});

export const OrderSchema = z.object({
	id: z.string(),
	test: z.string(),
	priority: z.enum(['routine', 'urgent', 'stat']),
	status: z.string(),
	notes: z.string().nullable(),
	sentAt: z.string().nullable(),
	patient: z.object({ name: z.string(), birthDate: z.string(), sex: z.string() }),
	orderingDoctor: z.string(),
	orderingFacility: z.string(),
});

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	orders: z.array(OrderSchema),
	truncated: z.boolean(),
});

export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;
export type Order = z.infer<typeof OrderSchema>;
