import z from 'zod/v3';

/**
 * The pages Wise may open (`open_page`, DESIGN.md §7.2), one entry each: Wise picks a key and its params, never a URL.
 * The API validates the params and checks access; the frontend navigates to `path` with them (TanStack Router path
 * syntax). A new screen needs only a line here. Admin-only pages are left out: Wise opens what any clinician can.
 */
const noParams = z.object({}).strict();
const patientParams = z.object({ patientId: z.string().uuid('Use the id that find_patient returned.') }).strict();

export const APP_PAGES = {
	'chat.new': { label: 'Today (and a new chat)', path: '/', params: noParams },
	'chats.list': { label: 'Wise chats', path: '/chats', params: noParams },
	'reports.list': { label: 'Reports (your Wise reports)', path: '/reports', params: noParams },
	'patients.list': { label: 'Patients', path: '/patients', params: noParams },
	'patients.new': { label: 'Register a patient', path: '/patients/new', params: noParams },
	'patients.detail': { label: 'Patient chart', path: '/patients/$patientId', params: patientParams },
	'patients.results': { label: "Patient's results", path: '/patients/$patientId/results', params: patientParams },
	'patients.cases': { label: "Patient's cases", path: '/patients/$patientId/cases', params: patientParams },
	'patients.messages': {
		label: 'Messages to the patient',
		path: '/patients/$patientId/messages',
		params: patientParams,
	},
	'results.inbox': { label: 'Results to review', path: '/results', params: noParams },
	'cases.list': { label: 'My cases', path: '/cases', params: noParams },
	worklist: { label: 'Nurse worklist', path: '/worklist', params: noParams },
	'referrals.inbox': { label: 'Referral inbox', path: '/referrals', params: noParams },
	'orders.inbox': { label: 'Lab order worklist (orders received)', path: '/orders', params: noParams },
	dashboard: { label: 'Program dashboard', path: '/dashboard', params: noParams },
	'pathways.list': { label: 'Clinical pathways and their rules', path: '/pathways', params: noParams },
	'settings.account': { label: 'Account settings', path: '/settings/account', params: noParams },
	'settings.appearance': { label: 'Appearance settings', path: '/settings/appearance', params: noParams },
	'settings.memory': { label: 'Memory settings', path: '/settings/memory', params: noParams },
	'settings.wiseTools': { label: 'Wise tools settings', path: '/settings/wise-tools', params: noParams },
} as const satisfies Record<string, { label: string; path: `/${string}`; params: z.ZodObject<z.ZodRawShape> }>;

export type AppPageKey = keyof typeof APP_PAGES;
export type AppPageParams<K extends AppPageKey = AppPageKey> = z.infer<(typeof APP_PAGES)[K]['params']>;

export const APP_PAGE_KEYS = Object.keys(APP_PAGES) as [AppPageKey, ...AppPageKey[]];

export const isAppPageKey = (key: string): key is AppPageKey => Object.hasOwn(APP_PAGES, key);

/** The page's params, parsed, or the reason they don't fit. */
export function parseAppPageParams(
	key: AppPageKey,
	params: unknown,
): { success: true; params: Record<string, string> } | { success: false; error: string } {
	const parsed = APP_PAGES[key].params.safeParse(params ?? {});
	if (!parsed.success) {
		const error = parsed.error.issues
			.map((issue) => (issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
			.join('; ');
		return { success: false, error };
	}
	return { success: true, params: parsed.data as Record<string, string> };
}

/** The URL of a page, with its params filled in (for links; navigation goes through the router). */
export function appPageHref(key: AppPageKey, params: Record<string, string>): string {
	return APP_PAGES[key].path.replace(/\$(\w+)/g, (_match, name: string) => encodeURIComponent(params[name] ?? ''));
}

/** One line per page for the tool description: key, what it is, and its params. */
export function describeAppPages(): string {
	return Object.entries(APP_PAGES)
		.map(([key, page]) => {
			const params = Object.keys(page.params.shape);
			return `${key} (${page.label}${params.length > 0 ? `; params: ${params.join(', ')}` : ''})`;
		})
		.join(', ');
}
