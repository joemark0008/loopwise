import z from 'zod/v3';

import { PATIENT_SEXES } from '../patient-registration';

export const MAX_MATCHES = 10;

export const description = [
	'Search the patients the user may see, by name, birth date or identifier (patient no. or an ID number such as',
	'PhilHealth).',
	'Use it whenever the user names a patient you need to look up or open, before open_page. It returns up to',
	`${MAX_MATCHES} matches with their ids. If there are several, ask which one with \`clarification\`; if none, say so.`,
	'Never guess or invent a patient id. Every search is recorded in the audit log.',
].join(' ');

export const InputSchema = z.object({
	query: z
		.string()
		.max(200)
		.optional()
		.describe('Name words (e.g. "Maria Santos") or one identifier (e.g. TAG-PT-2026-000001 or 12-345678901-2).'),
	birthDate: z.string().optional().describe('Birth date as YYYY-MM-DD, only if the user gave it.'),
});

export const MatchSchema = z.object({
	id: z.string(),
	name: z.string(),
	patientNo: z.string(),
	birthDate: z.string(),
	sex: z.enum(PATIENT_SEXES),
	/** Government / discount IDs: `label` names the kind (PhilHealth, PhilSys, Senior citizen …). */
	identifications: z.array(z.object({ label: z.string(), idNumber: z.string() })),
});

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	patients: z.array(MatchSchema),
	/** More patients matched than were returned: ask the user to narrow the search. */
	truncated: z.boolean(),
});

export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;
export type Match = z.infer<typeof MatchSchema>;
