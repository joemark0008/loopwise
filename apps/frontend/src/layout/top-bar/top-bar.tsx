import { Burger } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import {
	ChevronRight,
	Keyboard,
	LogOut,
	Monitor,
	Moon,
	SearchIcon,
	SlidersVertical,
	Sparkles,
	Sun,
} from 'lucide-react';

import styles from './top-bar.module.css';
import { Avatar } from '@/components/ui/avatar';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCommandMenuCallback } from '@/contexts/command-menu-callback';
import { useSidebar } from '@/contexts/sidebar';
import { useTheme } from '@/contexts/theme.provider';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useSignOut } from '@/hooks/use-sign-out';
import { getShortcutLabel } from '@/lib/keyboard-shortcuts';
import { formatDate } from '@/feature/encounters/encounter-format';
import { patientName } from '@/feature/patients/patient-format';
import { encounterRecordApi } from '@/lib/encounter-record-api';
import { crumbs } from '@/lib/navigation';
import { patientApi } from '@/lib/patient-api';

const THEME_OPTIONS = [
	{ value: 'light', label: 'Light', icon: Sun },
	{ value: 'dark', label: 'Dark', icon: Moon },
	{ value: 'system', label: 'System', icon: Monitor },
] as const;

export function TopBar({
	onOpenKeyboardShortcuts,
	wise,
}: {
	onOpenKeyboardShortcuts: () => void;
	/** The general Wise dock's toggle, on pages that offer it. */
	wise?: { open: boolean; onToggle: () => void };
}) {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const { isMobileOpen, openMobile, closeMobile } = useSidebar();
	const { fire: openCommandMenu } = useCommandMenuCallback();
	const trail = crumbs(pathname, useCrumbNames(pathname));

	return (
		<div className={styles.bar}>
			<Burger
				className={styles.burger}
				size='sm'
				opened={isMobileOpen}
				onClick={isMobileOpen ? closeMobile : openMobile}
				aria-label='Toggle navigation'
			/>
			<nav aria-label='Breadcrumb' className={styles.crumbs}>
				<ol className={styles.crumbList}>
					{trail.map((crumb, index) => {
						const isCurrent = index === trail.length - 1;
						return (
							<li key={`${index}-${crumb.label}`} className={styles.crumbItem}>
								{index > 0 && <ChevronRight className={styles.crumbSeparator} aria-hidden />}
								{isCurrent || !crumb.to ? (
									<span
										className={isCurrent ? styles.crumbCurrent : undefined}
										aria-current={isCurrent ? 'page' : undefined}
									>
										{crumb.label}
									</span>
								) : (
									<Link to={crumb.to as never} className={styles.crumbLink}>
										{crumb.label}
									</Link>
								)}
							</li>
						);
					})}
				</ol>
			</nav>
			<button type='button' className={styles.search} onClick={() => openCommandMenu()}>
				<SearchIcon />
				<span className={styles.searchLabel}>Find a patient or chat</span>
				<kbd className={styles.searchKey}>{getShortcutLabel('command-menu')}</kbd>
			</button>
			{wise && (
				<button
					type='button'
					className={styles.wise}
					onClick={wise.onToggle}
					aria-expanded={wise.open}
					aria-controls='wise-dock'
				>
					<Sparkles aria-hidden />
					<span className={styles.wiseLabel}>Ask Wise</span>
				</button>
			)}
			<AccountMenu onOpenKeyboardShortcuts={onOpenKeyboardShortcuts} />
		</div>
	);
}

function AccountMenu({ onOpenKeyboardShortcuts }: { onOpenKeyboardShortcuts: () => void }) {
	const navigate = useNavigate();
	const { data: user } = useCurrentUser();
	const { theme, setTheme } = useTheme();
	const signOut = useSignOut();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button type='button' className={styles.account} aria-label='Account menu'>
					<Avatar username={user?.name ?? '?'} size='sm' />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end' className={styles.menu}>
				<div className={styles.menuIdentity}>
					{user?.name}
					<span className={styles.menuEmail}>{user?.email}</span>
				</div>
				<DropdownMenuSeparator />
				<DropdownMenuLabel>Theme</DropdownMenuLabel>
				<DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as typeof theme)}>
					{THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
						<DropdownMenuRadioItem key={value} value={value} indicator='check'>
							<Icon />
							{label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={() => void navigate({ to: '/settings' })}>
					<SlidersVertical />
					Settings
				</DropdownMenuItem>
				<DropdownMenuItem onSelect={onOpenKeyboardShortcuts}>
					<Keyboard />
					Keyboard shortcuts
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={() => void signOut()}>
					<LogOut />
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * The names of the patient and encounter in the path, from what their pages already loaded. It never fetches: the
 * chart and encounter reads are audited, and a breadcrumb must not add a view.
 */
function useCrumbNames(pathname: string) {
	const [, patientId, encounterId] = pathname.match(/^\/patients\/([^/]+)(?:\/encounters\/([^/]+))?/) ?? [];
	const patient = useQuery({
		...patientApi.patient.get.queryOptions({ id: patientId ?? '' }),
		enabled: false,
	});
	const record = useQuery({
		...encounterRecordApi.encounterRecord.get.queryOptions({ encounterId: encounterId ?? '' }),
		enabled: false,
	});
	return {
		patient: patientId && patient.data ? patientName(patient.data) : undefined,
		encounter: encounterId && record.data ? `Encounter ${formatDate(record.data.encounter.startedAt)}` : undefined,
	};
}
