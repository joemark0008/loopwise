import { Link, useMatchRoute, useNavigate, useRouterState } from '@tanstack/react-router';
import { PanelLeft, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { SidebarBackToApp } from './sidebar-back-to-app';
import { SidebarSettingsNav } from './sidebar-settings-nav';
import { SidebarUserMenu } from './sidebar-user-menu';
import styles from './sidebar.module.css';
import type { NavLink } from '@/lib/navigation';
import { ProjectSwitcher } from '@/components/project-selector';

import LoopwiseFullLogo from '@/components/icons/loopwise-full-logo.svg';
import LoopwiseLogo from '@/components/icons/loopwise-logo.svg';
import { Button } from '@/components/ui/button';
import { SimpleTooltip, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSidebar } from '@/contexts/sidebar';
import { resetLastAppLocation, useTrackLastAppLocation } from '@/hooks/use-last-app-location';
import { useIsCloud } from '@/hooks/use-loopwise-mode';
import { useProjectSwitch } from '@/hooks/use-project-switch';
import { useStaffRole } from '@/hooks/use-staff-role';
import { getActiveProjectId, setActiveProjectId } from '@/lib/active-project';
import { getShortcutLabel } from '@/lib/keyboard-shortcuts';
import { roleNavLinks } from '@/lib/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { useCanSeeAdvancedSettings } from '@/hooks/use-can-see-advanced-settings';
import { useCurrentProject, useProjects } from '@/hooks/use-current-project';

export function Sidebar() {
	const navigate = useNavigate();
	const matchRoute = useMatchRoute();
	const {
		isCollapsed,
		isMobile,
		isMobileOpen,
		closeMobile,
		toggle: toggleSidebar,
		expand: expandSidebar,
	} = useSidebar();
	const [toggleHintOpen, setToggleHintOpen] = useState(false);
	const project = useCurrentProject();
	const projects = useProjects();
	const switchProject = useProjectSwitch(project.data?.id);
	const { isAdmin, isContextAdmin, isViewer } = usePermissions();
	const canSeeAdvancedSettings = useCanSeeAdvancedSettings();
	const isCloud = useIsCloud();
	const role = useStaffRole();

	const locationPath = useRouterState({ select: (s) => s.location.pathname });
	const isSettingsRoute = matchRoute({ to: '/settings', fuzzy: true });
	const isInSettings = !!isSettingsRoute && !isViewer;
	const effectiveIsCollapsed = isMobile ? false : isCollapsed;
	useTrackLastAppLocation();

	useEffect(() => {
		setToggleHintOpen(false);
	}, [effectiveIsCollapsed]);

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
		if (!project.data?.id) {
			return;
		}

		if (getActiveProjectId() !== project.data.id) {
			setActiveProjectId(project.data.id);
		}
	}, [project.data?.id]);

	const handleProjectChange = useCallback(
		async (projectId: string) => {
			const didSwitch = await switchProject(projectId);
			if (!didSwitch) {
				return;
			}
			resetLastAppLocation();
			if (isMobile) {
				closeMobile();
			}
		},
		[closeMobile, isMobile, switchProject],
	);

	return (
		<div className={styles.navbar} data-collapsed={effectiveIsCollapsed || undefined}>
			<div className={styles.brandRow}>
				<button type='button' onClick={handleNavigateHome} aria-label='Loopwise home' className={styles.brand}>
					{effectiveIsCollapsed ? (
						<LoopwiseLogo className={styles.brandMark} />
					) : (
						<LoopwiseFullLogo className={styles.brandLogo} />
					)}
				</button>
				{isMobile ? (
					<Button variant='ghost' size='icon-sm' onClick={closeMobile} aria-label='Close navigation'>
						<X />
					</Button>
				) : (
					<Tooltip open={toggleHintOpen} onOpenChange={setToggleHintOpen}>
						<TooltipTrigger asChild>
							<Button
								variant='ghost'
								size='icon-sm'
								onClick={() => toggleSidebar()}
								className={styles.toggle}
								aria-label='Toggle sidebar'
							>
								<PanelLeft />
							</Button>
						</TooltipTrigger>
						<TooltipContent side='right'>
							<span className={styles.toggleHint}>
								Toggle sidebar
								<kbd className={styles.toggleKbd}>{getShortcutLabel('toggle-sidebar')}</kbd>
							</span>
						</TooltipContent>
					</Tooltip>
				)}
			</div>

			{isInSettings && (
				<div className={styles.settingsHeader}>
					<SidebarBackToApp isCollapsed={effectiveIsCollapsed} />
					{!effectiveIsCollapsed && isAdmin && (
						<ProjectSwitcher
							projects={projects.data ?? []}
							currentProjectId={project.data?.id}
							onChange={handleProjectChange}
							variant='sidebar'
						/>
					)}
				</div>
			)}

			{isInSettings ? (
				<SidebarSettingsNav
					isCollapsed={effectiveIsCollapsed}
					canSeeAdvancedSettings={canSeeAdvancedSettings}
					isAdmin={isAdmin}
					isContextAdmin={isContextAdmin}
					isViewer={isViewer}
					isCloud={isCloud}
					hasProject={project.data != null}
				/>
			) : (
				<nav className={styles.section} aria-label='Main'>
					{roleNavLinks(role).map((link) => (
						<SidebarNavLink key={link.to} link={link} isCollapsed={effectiveIsCollapsed} />
					))}
					<div className={styles.spacer} />
				</nav>
			)}

			<div className={styles.footer}>
				<SidebarUserMenu isCollapsed={effectiveIsCollapsed} isInSettings={!!isInSettings} />
			</div>
		</div>
	);
}

function SidebarNavLink({ link, isCollapsed }: { link: NavLink; isCollapsed: boolean }) {
	const Icon = link.icon;
	const row = (
		<Link
			to={link.to}
			className={styles.row}
			data-collapsed={isCollapsed || undefined}
			activeOptions={{ exact: link.exact ?? false }}
			activeProps={{ 'aria-current': 'page', 'data-active': true }}
		>
			<Icon className={styles.rowIcon} aria-hidden />
			{isCollapsed ? (
				<span className='sr-only'>{link.label}</span>
			) : (
				<span className={styles.rowLabel}>{link.label}</span>
			)}
			{link.shortcut && <kbd className={isCollapsed ? 'sr-only' : styles.rowKbd}>{link.shortcut}</kbd>}
		</Link>
	);
	return isCollapsed ? (
		<SimpleTooltip content={link.label} side='right'>
			{row}
		</SimpleTooltip>
	) : (
		row
	);
}
