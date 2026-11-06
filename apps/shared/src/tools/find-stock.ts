import z from 'zod/v3';

export const MAX_ITEMS = 20;

export const description = [
	"Stock of a medicine or supply at this chat's clinic, read as the user (pharmacy and stock-room staff): matching items",
	'by generic name, brand, item name or SKU, each with the unexpired quantity on hand, the reorder level, whether it is',
	'low, and its lots (lot number, expiry, quantity) first expiry first out. Use it for "how much amoxicillin do we',
	'have". Read only: receiving, adjusting and dispensing are done on the Pharmacy pages, never from chat.',
].join(' ');

export const InputSchema = z.object({
	query: z.string().min(1).describe('Generic name, brand, item name or SKU, e.g. "amoxicillin".'),
});

export const LotSchema = z.object({
	lotNo: z.string(),
	expiryDate: z.string().nullable(),
	quantityOnHand: z.number(),
	/** EXPIRED or EXPIRING (within 90 days), else null. */
	alert: z.string().nullable(),
});

export const ItemSchema = z.object({
	id: z.string(),
	sku: z.string(),
	name: z.string(),
	genericName: z.string().nullable(),
	unit: z.string(),
	usableOnHand: z.number(),
	onHand: z.number(),
	reorderLevel: z.number().nullable(),
	isLowStock: z.boolean(),
	isDangerousDrug: z.boolean(),
	lots: z.array(LotSchema),
});

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	clinicName: z.string(),
	asOf: z.string(),
	items: z.array(ItemSchema),
	truncated: z.boolean(),
});

export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;
export type Item = z.infer<typeof ItemSchema>;
