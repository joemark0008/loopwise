import { AppShell } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { Outlet, useLocation, useNavigate, useRouterState } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { BottomNav } from './bottom-nav';
import { Sidebar } from './sidebar/sidebar';
import { TopBar } from './top-bar/top-bar';
import styles from './app-layout.module.css';
import { CommandMenu } from './command-menu';
import { KeyboardShortcutsDialog } from './keyboard-shortcuts-dialog';
import { WiseDock } from '@/feature/wise/wise-dock';
import { CommandMenuCallbackProvider, useCommandMenuCallback } from '@/contexts/command-menu-callback';
import { SidebarProvider, useSidebar } from '@/contexts/sidebar';
import { useTheme } from '@/contexts/theme.provider';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { usePermissions } from '@/hooks/use-permissions';
import { hasWiseDock, navLinks } from '@/lib/navigation';

const SEQUENCE_TIMEOUT_MS = 1000;

export function AppLayout() {
	return (
		<CommandMenuCallbackProvider>
			<SidebarProvider>
				<AppLayoutContent />
			</SidebarProvider>
		</CommandMenuCallbackProvider>
	);
}

function AppLayoutContent() {
	const { isCollapsed, isMobile, isMobileOpen, closeMobile } = useSidebar();
	const [keyboardShortcutsOpen, setKeyboardShortcutsOpen] = useState(false);
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const canDockWise = hasWiseDock(pathname);
	const [isWiseOpen, setIsWiseOpen] = useState(false);
	// Mounted on first open, then kept, so the conversation survives moving between pages.
	const [hasOpenedWise, setHasOpenedWise] = useState(false);
	const closeWise = useCallback(() => setIsWiseOpen(false), []);
	const toggleWise = useCallback(() => {
		setHasOpenedWise(true);
		setIsWiseOpen((open) => !open);
	}, []);

	return (
		<AppShell
			className={styles.shell}
			layout='alt'
			header={{ height: '3.75rem' }}
			navbar={{
				width: isCollapsed ? '4.5rem' : '15rem',
				breakpoint: 'sm',
				collapsed: { mobile: !isMobileOpen },
			}}
			transitionDuration={200}
			transitionTimingFunction='cubic-bezier(.2,.8,.2,1)'
			padding={0}
		>
			<GlobalShortcuts onOpenKeyboardShortcuts={() => setKeyboardShortcutsOpen(true)} />
			<CommandMenu onOpenKeyboardShortcuts={() => setKeyboardShortcutsOpen(true)} />
			<KeyboardShortcutsDialog open={keyboardShortcutsOpen} onOpenChange={setKeyboardShortcutsOpen} />
			<AppShell.Header withBorder={false}>
				<TopBar
					onOpenKeyboardShortcuts={() => setKeyboardShortcutsOpen(true)}
					wise={canDockWise ? { open: isWiseOpen, onToggle: toggleWise } : undefined}
				/>
			</AppShell.Header>
			<AppShell.Navbar withBorder={false} className={styles.navbar}>
				<Sidebar />
			</AppShell.Navbar>
			{isMobile && isMobileOpen && (
				<button type='button' className={styles.backdrop} onClick={closeMobile} aria-label='Close navigation' />
			)}
			<a href='#main' className={styles.skipLink}>
				Skip to main content
			</a>
			<AppShell.Main className={styles.main} id='main' tabIndex={-1}>
				<RouteFocus />
				<div className={`app-page ${styles.page}`}>
					<Outlet />
				</div>
				{isMobile && <BottomNav />}
			</AppShell.Main>
			{hasOpenedWise && <WiseDock open={isWiseOpen && canDockWise} onClose={closeWise} />}
		</AppShell>
	);
}

/**
 * After a route change, focus moves to the new page's h1 (or the main region), so a screen reader announces where you
 * are instead of staying on the link you followed. Search-param changes (tabs) keep focus where it is.
 */
function RouteFocus() {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const first = useRef(true);
	useEffect(() => {
		if (first.current) {
			first.current = false;
			return;
		}
		const frame = requestAnimationFrame(() => {
			const main = document.getElementById('main');
			const heading = main?.querySelector<HTMLElement>('h1');
			const target = heading ?? main;
			if (!target || target.contains(document.activeElement)) {
				return;
			}
			if (target === heading && !heading.hasAttribute('tabindex')) {
				heading.setAttribute('tabindex', '-1');
			}
			target.focus({ preventScroll: true });
		});
		return () => cancelAnimationFrame(frame);
	}, [pathname]);
	return null;
}

function GlobalShortcuts({ onOpenKeyboardShortcuts }: { onOpenKeyboardShortcuts: () => void }) {
	const navigate = useNavigate();
	const { pathname } = useLocation();
	const { toggle, isMobile } = useSidebar();
	const { theme, setTheme } = useTheme();
	const { fire: openCommandMenu } = useCommandMenuCallback();
	const { canStartNewChat } = usePermissions();

	const navigateHome = useCallback(() => navigate({ to: '/' }), [navigate]);
	const toggleTheme = useCallback(() => {
		setTheme(theme === 'light' ? 'dark' : 'light');
	}, [theme, setTheme]);

	useKeyboardShortcuts({
		'toggle-sidebar': toggle,
		'command-menu': openCommandMenu,
		'toggle-theme': toggleTheme,
		'new-chat': canStartNewChat ? navigateHome : undefined,
		'keyboard-help': onOpenKeyboardShortcuts,
	});

	// The settings sidebar binds `/` to its own search field.
	const isInSettings = pathname.startsWith('/settings');
	useHotkeys([
		['[', () => !isMobile && toggle()],
		['/', () => !isInSettings && openCommandMenu()],
	]);

	useGoToShortcuts();

	return null;
}

/** `G`, then a letter within a second, opens the page with that `NavLink.shortcut`. */
function useGoToShortcuts() {
	const navigate = useNavigate();
	const awaitingUntil = useRef(0);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			const isTyping = target?.closest('input, textarea, select, [contenteditable="true"]');
			if (isTyping || event.metaKey || event.ctrlKey || event.altKey) {
				return;
			}
			const key = event.key.toUpperCase();
			if (Date.now() < awaitingUntil.current) {
				awaitingUntil.current = 0;
				const link = navLinks.find((entry) => entry.shortcut === `G ${key}`);
				if (link) {
					event.preventDefault();
					void navigate({ to: link.to as never });
				}
				return;
			}
			if (key === 'G') {
				awaitingUntil.current = Date.now() + SEQUENCE_TIMEOUT_MS;
			}
		};
		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [navigate]);
}
