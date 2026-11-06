import z from 'zod/v3';

export const ALERT_KINDS = ['LOW_STOCK', 'EXPIRING', 'EXPIRED'] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

export const MAX_ROWS = 50;

export const description = [
	"The pharmacy's stock alerts at this chat's clinic, read as the user (pharmacy and stock-room staff): items at or",
	'below their reorder level (LOW_STOCK), lots with stock expiring within `withinDays` days (EXPIRING, default 90;',
	'use the days left in the month for "expiring this month") and expired lots still on the shelf (EXPIRED). Read',
	'only: disposing of, adjusting and reordering stock are done on the Pharmacy pages, never from chat.',
].join(' ');

export const InputSchema = z.object({
	kind: z.enum(ALERT_KINDS).optional().describe('One kind; default every kind.'),
	withinDays: z.number().int().min(1).max(365).optional().describe('Days ahead for EXPIRING (default 90).'),
});

export const LowStockSchema = z.object({
	itemId: z.string(),
	name: z.string(),
	unit: z.string(),
	usableOnHand: z.number(),
	reorderLevel: z.number(),
});

export const LotAlertSchema = z.object({
	itemId: z.string(),
	name: z.string(),
	lotNo: z.string(),
	expiryDate: z.string().nullable(),
	daysToExpiry: z.number().nullable(),
	quantityOnHand: z.number(),
});

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	clinicName: z.string(),
	asOf: z.string(),
	withinDays: z.number(),
	lowStock: z.array(LowStockSchema),
	expiring: z.array(LotAlertSchema),
	expired: z.array(LotAlertSchema),
});

export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;
