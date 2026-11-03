import z from 'zod/v3';

import { APP_PAGE_KEYS, describeAppPages } from '../app-pages';

export const description = [
	'Open a page of Loopwise for the user, shown as a link card in the chat. Pick the page by key; never write a URL.',
	`Pages: ${describeAppPages()}.`,
	'For a patient, call find_patient first and pass the id it returned as patientId; never invent one.',
	'Set userAskedToOpen to true only when the user explicitly asked to open, show or go to that page, so the app goes',
	'there by itself; otherwise the user clicks the card. Call it last in your turn, after a one-line reply.',
].join(' ');

export const InputSchema = z.object({
	page: z.enum(APP_PAGE_KEYS).describe('The page key.'),
	params: z
		.record(z.string())
		.optional()
		.describe('The params the page takes, e.g. {"patientId": "<id from find_patient>"}; omit for none.'),
	userAskedToOpen: z
		.boolean()
		.describe('True only if the user explicitly asked to open or go to this page (e.g. "open her chart").'),
});

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	key: z.enum(APP_PAGE_KEYS),
	params: z.record(z.string()),
	/** What the card says, e.g. "Maria Santos's chart". */
	label: z.string(),
	/** Whether the app goes there by itself, once, while the reply is live. */
	autoNavigate: z.boolean(),
});

export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;
