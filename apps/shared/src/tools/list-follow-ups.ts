import z from 'zod/v3';

export const MAX_FOLLOW_UPS = 60;

export const description = [
	"List the follow-ups at this chat's clinic that are overdue, due today or coming up within `withinDays` (default 7:",
	'"this week"), read as the user: the visits whose follow-up date the doctor set, with the disposition (for',
	'follow-up, referred …), until the patient has a later visit or booking with that doctor. A doctor gets their own',
	"patients' follow-ups; the front desk and admins the clinic's (filter by doctor). In a patient's chart chat, only",
	"that patient's. To book one, in the patient's chart chat call propose_appointment with the follow-up's doctor,",
	'its followUpDate (or the day the user wants) and visitType FOLLOW_UP; from a general chat, offer to open the',
	"patient's chart first. Never message the patient; never invent a follow-up.",
].join(' ');

export const InputSchema = z.object({
	withinDays: z
		.number()
		.int()
		.min(0)
		.max(60)
		.optional()
		.describe('Days ahead to include; default 7. Overdue ones always show.'),
	doctor: z.string().max(80).optional().describe('Words of the doctor\'s name, e.g. "Cruz" (front desk, admins).'),
});

export const FollowUpSchema = z.object({
	encounterId: z.string(),
	encounterNo: z.string(),
	patient: z.object({ id: z.string(), name: z.string(), patientNo: z.string() }),
	doctor: z.object({ id: z.string(), name: z.string() }).nullable(),
	visitDate: z.string(),
	/** YYYY-MM-DD: the suggested booking date. */
	followUpDate: z.string(),
	timing: z.enum(['OVERDUE', 'DUE', 'UPCOMING']),
	daysFromToday: z.number(),
	disposition: z.string().nullable(),
	reason: z.string().nullable(),
	diagnosis: z.string().nullable(),
});

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	clinicName: z.string(),
	today: z.string(),
	withinDays: z.number(),
	/** When a doctor was asked for: who matched. */
	doctor: z.string().nullable(),
	followUps: z.array(FollowUpSchema),
	truncated: z.boolean(),
});

export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;
export type FollowUp = z.infer<typeof FollowUpSchema>;
