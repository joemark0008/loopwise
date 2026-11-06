import z from 'zod/v3';

export const MAX_REFERRALS = 40;

export const description = [
	"List the user's referrals, read as the user: `inbox` the referrals sent to them by doctors of the organization,",
	'`outbox` the ones they sent (to a colleague, an outside doctor or a facility). By default only the pending ones:',
	'waiting for an answer (SENT) or accepted and not completed yet (ACCEPTED). Each has the patient, the other doctor or',
	'facility, the reason, the urgency and the status. Accepting, declining and completing are done on the Referrals',
	'page with the response dialog, never from chat; the letter prints from there too.',
].join(' ');

export const InputSchema = z.object({
	box: z.enum(['inbox', 'outbox']).optional().describe('Default inbox ("my pending referrals").'),
	includeClosed: z.boolean().optional().describe('Also completed, declined and cancelled ones.'),
});

export const ReferralSchema = z.object({
	id: z.string(),
	status: z.string(),
	urgency: z.string(),
	referredAt: z.string(),
	patient: z.object({ id: z.string(), name: z.string(), patientNo: z.string() }),
	encounterNo: z.string(),
	/** Who it is from (inbox) or to (outbox): a colleague, an outside doctor or a facility. */
	counterpart: z.string(),
	isInternal: z.boolean(),
	specialty: z.string().nullable(),
	reason: z.string(),
	responseNotes: z.string().nullable(),
});

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	box: z.enum(['inbox', 'outbox']),
	referrals: z.array(ReferralSchema),
	truncated: z.boolean(),
});

export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;
export type Referral = z.infer<typeof ReferralSchema>;
