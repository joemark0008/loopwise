import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import {
	Keyboard,
	LogOut,
	Monitor,
	Moon,
	PanelLeftClose,
	PanelLeftOpen,
	SearchIcon,
	SlidersVertical,
	Sparkles,
	Sun,
} from 'lucide-react';
import { Fragment } from 'react';

import { Avatar } from '@/components/ui/avatar';
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
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
import { Separator } from '@/components/ui/separator';
import { useSidebar } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCommandMenuCallback } from '@/contexts/command-menu-callback';
import { useIsDarkMode, useTheme } from '@/contexts/theme.provider';
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

/** The kit's site header: sidebar toggle and breadcrumb on the left; search, Wise, theme and account on the right. */
export function TopBar({
	onOpenKeyboardShortcuts,
	wise,
}: {
	onOpenKeyboardShortcuts: () => void;
	/** The general Wise dock's toggle, on pages that offer it. */
	wise?: { open: boolean; onToggle: () => void };
}) {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const { toggleSidebar, state, isMobile, openMobile } = useSidebar();
	const { fire: openCommandMenu } = useCommandMenuCallback();
	const trail = crumbs(pathname, useCrumbNames(pathname));
	const isOpen = isMobile ? openMobile : state === 'expanded';

	return (
		<header className='sticky top-0 z-(--app-z-sticky) flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/40 backdrop-blur-md transition-[width,height] ease-linear md:rounded-t-xl'>
			<div className='flex w-full min-w-0 items-center gap-1 px-3 lg:gap-2 lg:px-4'>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							size='icon-sm'
							variant='ghost'
							onClick={toggleSidebar}
							aria-label='Toggle sidebar'
							aria-expanded={isOpen}
						>
							{isOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
						</Button>
					</TooltipTrigger>
					<TooltipContent side='bottom'>
						Toggle sidebar
						<kbd data-slot='kbd' className='bg-background/20 px-1 font-sans'>
							{getShortcutLabel('toggle-sidebar')}
						</kbd>
					</TooltipContent>
				</Tooltip>
				<Separator orientation='vertical' className='mx-1 data-vertical:h-4 data-vertical:self-center' />
				<Breadcrumb aria-label='Breadcrumb' className='min-w-0 flex-1'>
					<BreadcrumbList className='flex-nowrap'>
						{trail.map((crumb, index) => {
							const isCurrent = index === trail.length - 1;
							return (
								<Fragment key={`${index}-${crumb.label}`}>
									{index > 0 && <BreadcrumbSeparator className='hidden sm:flex' />}
									<BreadcrumbItem className={isCurrent ? 'min-w-0' : 'hidden sm:inline-flex'}>
										{isCurrent || !crumb.to ? (
											<BreadcrumbPage
												role={undefined}
												aria-disabled={undefined}
												aria-current={isCurrent ? 'page' : undefined}
												className={isCurrent ? 'truncate font-medium' : 'text-muted-foreground'}
											>
												{crumb.label}
											</BreadcrumbPage>
										) : (
											<BreadcrumbLink asChild>
												<Link to={crumb.to as never}>{crumb.label}</Link>
											</BreadcrumbLink>
										)}
									</BreadcrumbItem>
								</Fragment>
							);
						})}
					</BreadcrumbList>
				</Breadcrumb>

				<div className='ml-auto flex shrink-0 items-center gap-1.5 lg:gap-2'>
					<Button
						variant='outline'
						size='sm'
						onClick={() => openCommandMenu()}
						className='w-9 justify-center px-0 text-muted-foreground shadow-none sm:w-56 sm:justify-start sm:px-2.5 lg:w-64 dark:bg-input/20'
					>
						<SearchIcon />
						<span className='sr-only text-left font-normal sm:not-sr-only sm:flex-1'>
							Find a patient or chat
						</span>
						<kbd
							data-slot='kbd'
							className='pointer-events-none hidden h-5 items-center rounded-sm bg-muted px-1.5 font-sans text-xs font-medium sm:inline-flex'
						>
							{getShortcutLabel('command-menu')}
						</kbd>
					</Button>
					{wise && (
						<Button
							variant='outline'
							size='sm'
							onClick={wise.onToggle}
							aria-expanded={wise.open}
							aria-controls='wise-dock'
							className='border-wise-line bg-wise-bg font-semibold text-wise hover:bg-wise-bg/70 hover:text-wise aria-expanded:bg-background aria-expanded:text-wise dark:border-wise-line dark:bg-wise-bg'
						>
							<Sparkles aria-hidden />
							<span className='sr-only sm:not-sr-only'>Ask Wise</span>
						</Button>
					)}
					<ThemeSwitch />
					<Separator orientation='vertical' className='mx-1 data-vertical:h-4 data-vertical:self-center' />
					<AccountMenu onOpenKeyboardShortcuts={onOpenKeyboardShortcuts} />
				</div>
			</div>
		</header>
	);
}

/** The kit's one-click light/dark switch; the account menu also offers "System". */
function ThemeSwitch() {
	const { setTheme } = useTheme();
	const isDark = useIsDarkMode();
	return (
		<Button
			size='icon-sm'
			variant='ghost'
			onClick={() => setTheme(isDark ? 'light' : 'dark')}
			aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
			className='hidden sm:inline-flex'
		>
			{isDark ? <Sun /> : <Moon />}
		</Button>
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
				<button
					type='button'
					className='inline-flex size-8 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
					aria-label='Account menu'
				>
					<Avatar username={user?.name ?? '?'} size='sm' decorative />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end' className='w-64'>
				<DropdownMenuLabel className='p-0 font-normal'>
					<div className='flex items-center gap-3 px-1.5 py-2 text-left text-sm'>
						<Avatar username={user?.name ?? '?'} decorative />
						<div className='grid flex-1 leading-tight'>
							<span className='truncate font-semibold text-foreground'>{user?.name}</span>
							<span className='truncate text-xs text-muted-foreground'>{user?.email}</span>
						</div>
					</div>
				</DropdownMenuLabel>
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
				<DropdownMenuItem variant='destructive' onSelect={() => void signOut()}>
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
