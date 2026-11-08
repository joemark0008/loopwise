import { Link, useMatchRoute, useNavigate, useRouterState } from '@tanstack/react-router';
import { useCallback, useEffect } from 'react';
import { SidebarBackToApp } from './sidebar-back-to-app';
import { SidebarSettingsNav } from './sidebar-settings-nav';
import { SidebarUserMenu } from './sidebar-user-menu';
import type { NavLink } from '@/lib/navigation';
import { ClinicSwitcher } from '@/components/clinic-selector';

import LoopwiseFullLogo from '@/components/icons/loopwise-full-logo.svg';
import LoopwiseLogo from '@/components/icons/loopwise-logo.svg';
import {
	Sidebar as SidebarRoot,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	useSidebar,
} from '@/components/ui/sidebar';
import { resetLastAppLocation, useTrackLastAppLocation } from '@/hooks/use-last-app-location';
import { useIsCloud } from '@/hooks/use-loopwise-mode';
import { useClinicSwitch } from '@/hooks/use-clinic-switch';
import { useDesks } from '@/hooks/use-staff-role';
import { getActiveClinicId, setActiveClinicId } from '@/lib/active-clinic';
import { deskNavLinks } from '@/lib/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { useCanSeeAdvancedSettings } from '@/hooks/use-can-see-advanced-settings';
import { useCurrentClinic, useClinics } from '@/hooks/use-current-clinic';

/** The kit's inset sidebar: brand, the desk's pages (or the settings tree), and the signed-in user. */
export function Sidebar() {
	const navigate = useNavigate();
	const matchRoute = useMatchRoute();
	const { isCollapsed, isMobile, isMobileOpen, closeMobile, expand: expandSidebar } = useSidebar();
	const clinic = useCurrentClinic();
	const clinics = useClinics();
	const switchClinic = useClinicSwitch(clinic.data?.id);
	const { isAdmin, isContextAdmin, isViewer } = usePermissions();
	const canSeeAdvancedSettings = useCanSeeAdvancedSettings();
	const isCloud = useIsCloud();
	const desks = useDesks();

	const locationPath = useRouterState({ select: (s) => s.location.pathname });
	const isSettingsRoute = matchRoute({ to: '/settings', fuzzy: true });
	const isInSettings = !!isSettingsRoute && !isViewer;
	const effectiveIsCollapsed = isMobile ? false : isCollapsed;
	useTrackLastAppLocation();

	useEffect(() => {
		if (isInSettings) {
			expandSidebar({ persist: false });
		}
	}, [isInSettings, expandSidebar]);

	useEffect(() => {
		if (isMobile && isMobileOpen) {
			closeMobile();
		}
	}, [locationPath]); // eslint-disable-line react-hooks/exhaustive-deps

	const handleNavigateHome = useCallback(() => {
		navigate({ to: '/' });
		if (isMobile) {
			closeMobile();
		}
	}, [navigate, isMobile, closeMobile]);

	useEffect(() => {
		if (!clinic.data?.id) {
			return;
		}

		if (getActiveClinicId() !== clinic.data.id) {
			setActiveClinicId(clinic.data.id);
		}
	}, [clinic.data?.id]);

	const handleClinicChange = useCallback(
		async (clinicId: string) => {
			const didSwitch = await switchClinic(clinicId);
			if (!didSwitch) {
				return;
			}
			resetLastAppLocation();
			if (isMobile) {
				closeMobile();
			}
		},
		[closeMobile, isMobile, switchClinic],
	);

	return (
		<SidebarRoot variant='inset' collapsible='icon'>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							size='lg'
							onClick={handleNavigateHome}
							aria-label='Loopwise home'
							className='h-10 hover:bg-transparent group-data-[collapsible=icon]:px-0!'
						>
							{effectiveIsCollapsed ? (
								<LoopwiseLogo className='size-6! shrink-0' aria-hidden />
							) : (
								<LoopwiseFullLogo className='h-6! w-auto! shrink-0' aria-hidden />
							)}
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
				{isInSettings && (
					<div className='flex flex-col gap-2'>
						<SidebarBackToApp isCollapsed={effectiveIsCollapsed} />
						{!effectiveIsCollapsed && isAdmin && (
							<ClinicSwitcher
								clinics={clinics.data ?? []}
								currentClinicId={clinic.data?.id}
								onChange={handleClinicChange}
								variant='sidebar'
							/>
						)}
					</div>
				)}
			</SidebarHeader>

			<SidebarContent className='scroll-fade-y'>
				{isInSettings ? (
					<SidebarSettingsNav
						isCollapsed={effectiveIsCollapsed}
						canSeeAdvancedSettings={canSeeAdvancedSettings}
						isAdmin={isAdmin}
						isContextAdmin={isContextAdmin}
						isViewer={isViewer}
						isCloud={isCloud}
						hasClinic={clinic.data != null}
					/>
				) : (
					<SidebarGroup>
						<SidebarGroupLabel>Desk</SidebarGroupLabel>
						<SidebarGroupContent>
							<nav aria-label='Main'>
								<SidebarMenu>
									{deskNavLinks(desks).map((link) => (
										<SidebarNavLink key={link.to} link={link} isCollapsed={effectiveIsCollapsed} />
									))}
								</SidebarMenu>
							</nav>
						</SidebarGroupContent>
					</SidebarGroup>
				)}
			</SidebarContent>

			<SidebarFooter>
				<SidebarUserMenu isCollapsed={effectiveIsCollapsed} isInSettings={!!isInSettings} />
			</SidebarFooter>
			<SidebarRail />
		</SidebarRoot>
	);
}

function SidebarNavLink({ link, isCollapsed }: { link: NavLink; isCollapsed: boolean }) {
	const Icon = link.icon;
	return (
		<SidebarMenuItem>
			<SidebarMenuButton asChild tooltip={link.label}>
				<Link
					to={link.to}
					activeOptions={{ exact: link.exact ?? false }}
					activeProps={{ 'aria-current': 'page' }}
				>
					<Icon aria-hidden />
					{isCollapsed ? <span className='sr-only'>{link.label}</span> : <span>{link.label}</span>}
				</Link>
			</SidebarMenuButton>
			{link.shortcut && (
				<SidebarMenuBadge className='opacity-0 transition-opacity group-hover/menu-item:opacity-100'>
					<kbd className={isCollapsed ? 'sr-only' : 'font-sans text-[0.6875rem] text-muted-foreground'}>
						{link.shortcut}
					</kbd>
				</SidebarMenuBadge>
			)}
		</SidebarMenuItem>
	);
}
