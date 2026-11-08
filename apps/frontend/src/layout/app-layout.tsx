import { Outlet, useLocation, useNavigate, useRouterState } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { BottomNav } from './bottom-nav';
import { Sidebar } from './sidebar/sidebar';
import { TopBar } from './top-bar/top-bar';
import { CommandMenu } from './command-menu';
import { KeyboardShortcutsDialog } from './keyboard-shortcuts-dialog';
import type { CSSProperties } from 'react';
import { SidebarInset, SidebarWrapper } from '@/components/ui/sidebar';
import { WiseDock } from '@/feature/wise/wise-dock';
import { CommandMenuCallbackProvider, useCommandMenuCallback } from '@/contexts/command-menu-callback';
import { SidebarProvider, useSidebar } from '@/contexts/sidebar';
import { useTheme } from '@/contexts/theme.provider';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { usePermissions } from '@/hooks/use-permissions';
import { hasWiseDock, navLinks } from '@/lib/navigation';

const SEQUENCE_TIMEOUT_MS = 1000;

/** The kit's shell measurements: header height and the gap the inset keeps from the window edge. */
const SHELL_STYLE = {
	'--header-height': 'calc(var(--spacing) * 14)',
} as CSSProperties;

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
	const { isMobile } = useSidebar();
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
		<SidebarWrapper style={SHELL_STYLE}>
			<a
				href='#main'
				className='fixed top-2 left-2 z-1000 -translate-y-[200%] rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground focus:translate-y-0'
			>
				Skip to main content
			</a>
			<GlobalShortcuts onOpenKeyboardShortcuts={() => setKeyboardShortcutsOpen(true)} />
			<CommandMenu onOpenKeyboardShortcuts={() => setKeyboardShortcutsOpen(true)} />
			<KeyboardShortcutsDialog open={keyboardShortcutsOpen} onOpenChange={setKeyboardShortcutsOpen} />
			<Sidebar />
			<SidebarInset id='main' tabIndex={-1} className='focus:outline-none'>
				<TopBar
					onOpenKeyboardShortcuts={() => setKeyboardShortcutsOpen(true)}
					wise={canDockWise ? { open: isWiseOpen, onToggle: toggleWise } : undefined}
				/>
				<RouteFocus />
				<div className='app-page @container/main flex min-h-0 min-w-0 flex-1'>
					<Outlet />
				</div>
				{isMobile && <BottomNav />}
			</SidebarInset>
			{hasOpenedWise && <WiseDock open={isWiseOpen && canDockWise} onClose={closeWise} />}
		</SidebarWrapper>
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

	// `[` toggles the sidebar and `/` opens search; the settings sidebar binds `/` to its own search field.
	const isInSettings = pathname.startsWith('/settings');
	useSingleKeys({
		'[': () => !isMobile && toggle(),
		'/': () => !isInSettings && openCommandMenu(),
	});

	useGoToShortcuts();

	return null;
}

/** Bare-key shortcuts, ignored while typing or with a modifier held. */
function useSingleKeys(bindings: Record<string, () => void>) {
	const bindingsRef = useRef(bindings);
	bindingsRef.current = bindings;
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			const isTyping = target?.closest('input, textarea, select, [contenteditable="true"]');
			if (isTyping || event.metaKey || event.ctrlKey || event.altKey) {
				return;
			}
			const handler = bindingsRef.current[event.key];
			if (handler) {
				event.preventDefault();
				handler();
			}
		};
		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, []);
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
