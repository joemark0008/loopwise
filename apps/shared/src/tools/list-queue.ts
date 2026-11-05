import z from 'zod/v3';

export const QUEUE_STATIONS = ['TRIAGE', 'DOCTOR', 'CASHIER'] as const;
export type QueueStation = (typeof QUEUE_STATIONS)[number];

export const description = [
	"Who's next: today's queue at this chat's clinic, read as the user, in call order (the priority lane first: seniors,",
	'PWDs, pregnant, with an infant, emergency; then by arrival). Each ticket has its number (A-007, P-002), station',
	"(triage, a doctor's room, the cashier), status (waiting, called, serving, skipped, done) and, when the user may see",
	"them, the patient. `next` is the number the station calls next. Use station DOCTOR with mine=true for a doctor's",
	'own line. Calling, sending on and checking in are done on the queue pages, never from chat.',
].join(' ');

export const InputSchema = z.object({
	station: z.enum(QUEUE_STATIONS).optional().describe('One station; default every line.'),
	mine: z.boolean().optional().describe("The user's own line as a doctor."),
	includeDone: z.boolean().optional().describe('Also the tickets done or cancelled today.'),
});

export const TicketSchema = z.object({
	code: z.string(),
	status: z.string(),
	station: z.enum(QUEUE_STATIONS),
	stationLabel: z.string(),
	isPriority: z.boolean(),
	priorityReason: z.string().nullable(),
	issuedAt: z.string(),
	/** Null when the user may not see the patient. */
	patient: z.object({ id: z.string(), name: z.string() }).nullable(),
	reason: z.string().nullable(),
	doctor: z.string().nullable(),
});

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	date: z.string(),
	clinicName: z.string(),
	next: z.string().nullable(),
	waiting: z.number(),
	tickets: z.array(TicketSchema),
});

export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;
export type Ticket = z.infer<typeof TicketSchema>;
