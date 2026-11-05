import z from 'zod/v3';

export const MAX_APPOINTMENTS = 60;

export const description = [
	"List the appointments at this chat's clinic on one day (today unless the user names another), read as the user,",
	'by time: each with its id, time, patient, doctor, visit type, booking channel, status and whether the patient is',
	'checked in. Filter by doctor when the user names one ("today\'s appointments for Dr. Reyes"); in a patient\'s',
	"chart chat, only that patient's appointments unless the user asks for the whole day. To book or move one, call",
	'propose_appointment or propose_reschedule (with the id from here). Never invent an appointment; patients the user',
	"may not see aren't listed.",
].join(' ');

export const InputSchema = z.object({
	date: z.string().optional().describe('YYYY-MM-DD (Asia/Manila); default today.'),
	doctor: z.string().max(80).optional().describe('Words of the doctor\'s name, e.g. "Reyes".'),
	wholeDay: z
		.boolean()
		.optional()
		.describe("In a patient's chart chat: true for every patient's appointments that day."),
});

export const AppointmentSchema = z.object({
	id: z.string(),
	/** HH:MM, Manila. */
	time: z.string(),
	scheduledStart: z.string(),
	status: z.string(),
	visitType: z.string(),
	channel: z.string(),
	reason: z.string().nullable(),
	checkedIn: z.boolean(),
	patient: z.object({ id: z.string(), name: z.string(), patientNo: z.string() }),
	doctor: z.object({ id: z.string(), name: z.string() }),
});

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	date: z.string(),
	clinicName: z.string(),
	/** When a doctor was asked for: who matched. */
	doctor: z.string().nullable(),
	appointments: z.array(AppointmentSchema),
	truncated: z.boolean(),
});

export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;
export type Appointment = z.infer<typeof AppointmentSchema>;
