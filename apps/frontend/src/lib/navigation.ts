import {
	Banknote,
	BookOpen,
	Boxes,
	Building2,
	CalendarCheck,
	CalendarClock,
	CalendarDays,
	ChartColumn,
	Contact,
	FileText,
	FlaskConical,
	HardDrive,
	Hash,
	HeartPulse,
	ListOrdered,
	MessageSquare,
	MessagesSquare,
	Palette,
	Pill,
	ReceiptText,
	Send,
	Settings2,
	Sparkles,
	Stethoscope,
	Sun,
	TestTubes,
	UserRound,
	Users,
	UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { FileRouteTypes } from '@/routeTree.gen';

export type AppPath = Extract<FileRouteTypes['to'], `/${string}`>;

export type NavSection = 'workspace' | 'user' | 'clinic' | 'context' | 'observability' | 'instance';

export interface NavContext {
	canSeeAdvancedSettings: boolean;
	isAdmin: boolean;
	isContextAdmin: boolean;
	isCloud: boolean;
	isViewer: boolean;
}

/**
 * Who the signed-in user is in the loop (DESIGN.md §1): their desk, from their clinic roles (`use-staff-role.ts`).
 * Each desk has its own home and sidebar.
 */
export type StaffRole = 'doctor' | 'nurse' | 'lab' | 'front_desk' | 'cashier' | 'pharmacy' | 'specialist' | 'program';

export interface NavLink {
	icon: LucideIcon;
	label: string;
	to: AppPath;
	section: NavSection;
	search?: { admin?: boolean };
	/** Match exactly, not as a prefix. */
	exact?: boolean;
	/** 'G S' opens this page: G, then the letter within a second. */
	shortcut?: string;
	/** Routable and searchable, but no sidebar row. */
	sidebar?: false;
	/** Path segment to breadcrumb label. */
	tabs?: Record<string, string>;
	leavesSettings?: boolean;
	requiresClinic?: boolean;
	visible?: (context: NavContext) => boolean;
	/** Workspace links: the roles whose sidebar shows it (in this order). */
	roles?: StaffRole[];
}

export const NAV_SECTIONS: { id: NavSection; label: string; isAdvanced?: boolean; isSettings?: boolean }[] = [
	{ id: 'workspace', label: 'Workspace' },
	{ id: 'user', label: 'User', isSettings: true },
	{ id: 'clinic', label: 'Clinic', isSettings: true, isAdvanced: true },
	{ id: 'context', label: 'Context', isSettings: true, isAdvanced: true },
	{ id: 'observability', label: 'Observability', isSettings: true, isAdvanced: true },
	{ id: 'instance', label: 'Instance', isSettings: true, isAdvanced: true },
];

const isMember = ({ isViewer }: NavContext) => !isViewer;
const isContextManager = ({ isAdmin, isContextAdmin }: NavContext) => isAdmin || isContextAdmin;
/** loopwise's clinic, model and usage settings: kept for the admin who runs the instance, hidden from clinicians. */
const isInstanceAdmin = ({ isAdmin }: NavContext) => isAdmin;

const CLINICIANS: StaffRole[] = ['doctor', 'nurse', 'specialist'];

export const navLinks: NavLink[] = [
	{
		icon: Sun,
		label: 'Today',
		to: '/',
		exact: true,
		section: 'workspace',
		shortcut: 'G H',
		roles: ['doctor', 'specialist'],
	},
	{ icon: TestTubes, label: 'Lab worklist', to: '/orders', section: 'workspace', roles: ['lab'] },
	{
		icon: Pill,
		label: 'Pharmacy',
		to: '/pharmacy',
		section: 'workspace',
		roles: ['pharmacy'],
		tabs: {
			dispense: 'Dispense',
			items: 'Items',
			receive: 'Receive stock',
			suppliers: 'Suppliers',
			consumption: 'Supplies used',
		},
	},
	{ icon: CalendarDays, label: 'Appointments', to: '/appointments', section: 'workspace', roles: ['front_desk'] },
	{ icon: HeartPulse, label: 'Triage', to: '/triage', section: 'workspace', roles: ['nurse'] },
	{ icon: ListOrdered, label: 'Queue', to: '/queue', section: 'workspace', roles: ['front_desk', 'cashier'] },
	{ icon: Banknote, label: 'Cashier', to: '/cashier', section: 'workspace', roles: ['cashier'] },
	{ icon: ListOrdered, label: 'My queue', to: '/my-queue', section: 'workspace', roles: ['doctor'] },
	{
		icon: CalendarCheck,
		label: 'Follow-ups',
		to: '/follow-ups',
		section: 'workspace',
		roles: ['doctor', 'front_desk'],
	},
	{ icon: Send, label: 'Referrals', to: '/referrals', section: 'workspace', roles: ['doctor', 'specialist'] },
	{
		icon: Contact,
		label: 'Patients',
		to: '/patients',
		section: 'workspace',
		shortcut: 'G T',
		tabs: { new: 'Register' },
		roles: [...CLINICIANS, 'front_desk'],
	},
	{
		icon: FlaskConical,
		label: 'Results',
		to: '/results',
		section: 'workspace',
		shortcut: 'G R',
		roles: ['doctor', 'specialist'],
	},
	{
		icon: MessageSquare,
		label: 'Wise chats',
		to: '/chats',
		section: 'workspace',
		shortcut: 'G W',
		roles: ['doctor', 'specialist', 'program', 'pharmacy'],
	},
	{
		icon: FileText,
		label: 'Reports',
		to: '/reports',
		section: 'workspace',
		roles: ['doctor', 'specialist', 'program'],
	},
	{
		icon: UserRound,
		label: 'Account',
		to: '/settings/account',
		section: 'user',
		exact: true,
		shortcut: 'G A',
		visible: isMember,
	},
	{
		icon: Sparkles,
		label: 'Wise tools',
		to: '/settings/wise-tools',
		section: 'user',
		exact: true,
		visible: isMember,
	},
	{
		icon: Settings2,
		label: 'Clinic Settings',
		to: '/settings/clinic',
		section: 'clinic',
		exact: true,
		shortcut: 'G P',
		visible: isInstanceAdmin,
	},
	{
		icon: Building2,
		label: 'Clinic profile',
		to: '/settings/clinic/profile',
		section: 'clinic',
		requiresClinic: true,
		visible: isInstanceAdmin,
	},
	{
		icon: Stethoscope,
		label: 'Practitioners',
		to: '/settings/clinic/practitioners',
		section: 'clinic',
		requiresClinic: true,
		visible: isInstanceAdmin,
	},
	{
		icon: ReceiptText,
		label: 'Services and prices',
		to: '/settings/clinic/services',
		section: 'clinic',
		requiresClinic: true,
		visible: isInstanceAdmin,
	},
	{
		icon: UsersRound,
		label: 'Staff and roles',
		to: '/settings/clinic/staff',
		section: 'clinic',
		requiresClinic: true,
		visible: isInstanceAdmin,
	},
	{
		icon: Hash,
		label: 'Numbering',
		to: '/settings/clinic/numbering',
		section: 'clinic',
		requiresClinic: true,
		visible: isInstanceAdmin,
	},
	{
		icon: CalendarClock,
		label: 'Expiring licenses',
		to: '/settings/clinic/expiries',
		section: 'clinic',
		requiresClinic: true,
		visible: isInstanceAdmin,
	},
	{
		icon: Boxes,
		label: 'AI and models',
		to: '/settings/clinic/agent',
		section: 'clinic',
		requiresClinic: true,
		visible: isInstanceAdmin,
	},
	{
		icon: BookOpen,
		label: 'Skills',
		to: '/settings/clinic/skills',
		section: 'clinic',
		requiresClinic: true,
		visible: isInstanceAdmin,
	},
	{
		icon: Palette,
		label: 'Appearance',
		to: '/settings/appearance',
		section: 'clinic',
		requiresClinic: true,
		visible: isMember,
	},
	{
		icon: ChartColumn,
		label: 'Usage & Costs',
		to: '/settings/usage',
		section: 'observability',
		requiresClinic: true,
		visible: isInstanceAdmin,
	},
	{
		icon: MessagesSquare,
		label: 'Chat with Loopwise data',
		to: '/',
		search: { admin: true },
		section: 'observability',
		exact: true,
		leavesSettings: true,
		visible: (context) => isInstanceAdmin(context) && isContextManager(context),
	},
	{
		icon: Users,
		label: 'Users',
		to: '/settings/users',
		section: 'instance',
		visible: ({ isAdmin }) => isAdmin,
	},
	{
		icon: HardDrive,
		label: 'Storage',
		to: '/settings/storage',
		section: 'instance',
		visible: ({ isAdmin, isCloud }) => isAdmin && !isCloud,
	},
];

export function getVisibleSettingsNavGroups(context: NavContext, hasClinic = true) {
	return NAV_SECTIONS.filter((section) => section.isSettings)
		.filter((section) => !section.isAdvanced || context.canSeeAdvancedSettings)
		.map((section) => ({
			label: section.label,
			items: navLinks.filter(
				(link) =>
					link.section === section.id &&
					link.sidebar !== false &&
					(!link.requiresClinic || hasClinic) &&
					(link.visible?.(context) ?? true),
			),
		}))
		.filter((group) => group.items.length > 0);
}

/** The longest matching `to` owns the current path. */
function owningLink(pathname: string): NavLink | undefined {
	return navLinks
		.filter((link) => !link.search)
		.filter((link) => pathname === link.to || (link.to !== '/' && pathname.startsWith(`${link.to}/`)))
		.sort((a, b) => b.to.length - a.to.length)[0];
}

/** The sidebar of a role: its workspace links, home first. */
export function roleNavLinks(role: StaffRole): NavLink[] {
	return navLinks.filter((link) => link.section === 'workspace' && link.roles?.includes(role));
}

/**
 * The sidebar of a user who can open several desks (`useDesks()`: an admin opens every desk): their own desk's links,
 * then the home of each other desk they can open.
 */
export function deskNavLinks(desks: readonly StaffRole[]): NavLink[] {
	const [own, ...others] = desks;
	const links = own ? roleNavLinks(own) : [];
	for (const desk of others) {
		const home = roleNavLinks(desk)[0];
		if (home && !links.some((link) => link.to === home.to)) {
			links.push(home);
		}
	}
	return links;
}

export interface Crumb {
	label: string;
	/** Links back up the trail; the last crumb is the current page. */
	to?: string;
}

/**
 * The breadcrumb trail of a path. `names` resolves the ids in it (a patient's name, an encounter's date) when the page
 * has them; the clinical trail is Patients › Maria Santos › Encounter 22 Oct 2026.
 */
export function crumbs(pathname: string, names: { patient?: string; encounter?: string } = {}): Crumb[] {
	const patient = pathname.match(/^\/patients\/([^/]+)(?:\/(encounters\/[^/]+|[^/]+))?/);
	if (patient && patient[1] !== 'new') {
		const trail: Crumb[] = [
			{ label: 'Patients', to: '/patients' },
			{ label: names.patient ?? 'Patient', to: `/patients/${patient[1]}` },
		];
		const sub = patient[2];
		if (sub?.startsWith('encounters/')) {
			trail.push({ label: names.encounter ?? 'Encounter' });
		} else if (sub) {
			trail.push({ label: PATIENT_TABS[sub] ?? sub });
		}
		return trail;
	}
	const link = owningLink(pathname);
	if (!link) {
		// Everything else under the root is an open chat.
		return [{ label: 'Wise chats', to: '/chats' }, { label: 'Chat' }];
	}
	if (link.section === 'workspace') {
		const trail: Crumb[] = [{ label: link.label, to: link.to }];
		if (pathname !== link.to) {
			const segment = pathname.slice(link.to.length + 1).split('/')[0];
			trail.push({ label: link.tabs?.[segment] ?? 'Details' });
		}
		return trail;
	}
	const parts = [NAV_SECTIONS.find((section) => section.id === link.section)?.label, link.label];
	if (pathname !== link.to) {
		const segment = pathname.slice(link.to.length + 1).split('/')[0];
		parts.push(link.tabs?.[segment] ?? 'Details');
	}
	return (parts.filter(Boolean) as string[])
		.filter((part, index, all) => index === 0 || part.toLowerCase() !== all[index - 1].toLowerCase())
		.map((label) => ({ label }));
}

/** The patient's own pages beside the chart (routes/_protected/patients.$patientId.*). */
export const PATIENT_TABS: Record<string, string> = {
	results: 'Results',
};

/**
 * Whether the top bar offers the general Wise dock here. Not on Today or a chat (Wise is the page), a patient's pages
 * (the patient's own Wise is docked there) or settings.
 */
export function hasWiseDock(pathname: string): boolean {
	if (pathname === '/' || pathname.startsWith('/settings') || /^\/patients\/(?!new$)[^/]+/.test(pathname)) {
		return false;
	}
	return owningLink(pathname) !== undefined;
}
