import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowUpRight, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { NavContext } from '@/lib/navigation';
import { getVisibleSettingsNavGroups } from '@/lib/navigation';
import { useSettingsSearch } from '@/hooks/use-settings-search';
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

interface SidebarSettingsNavProps {
	isCollapsed: boolean;
	canSeeAdvancedSettings: boolean;
	isAdmin: boolean;
	isContextAdmin: boolean;
	isViewer: boolean;
	isCloud: boolean;
	hasClinic: boolean;
}

export function SidebarSettingsNav({
	isCollapsed,
	canSeeAdvancedSettings,
	isAdmin,
	isContextAdmin,
	isViewer,
	isCloud,
	hasClinic,
}: SidebarSettingsNavProps) {
	const navigate = useNavigate();
	const inputRef = useRef<HTMLInputElement>(null);
	const [query, setQuery] = useState('');
	const [isSearchFocused, setIsSearchFocused] = useState(false);

	const navContext: NavContext = {
		canSeeAdvancedSettings,
		isAdmin,
		isContextAdmin,
		isCloud,
		isViewer,
	};
	const navGroups = getVisibleSettingsNavGroups(navContext, hasClinic);

	useEffect(() => {
		const handleSlashKey = (e: KeyboardEvent) => {
			if (e.key !== '/' || isCollapsed || isViewer) {
				return;
			}
			const tag = (e.target as HTMLElement)?.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
				return;
			}
			e.preventDefault();
			inputRef.current?.focus();
		};
		document.addEventListener('keydown', handleSlashKey);
		return () => document.removeEventListener('keydown', handleSlashKey);
	}, [isCollapsed, isViewer]);

	const results = useSettingsSearch(query);

	const isSearching = query.length >= 2;

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Escape') {
			setQuery('');
			inputRef.current?.blur();
		} else if (e.key === 'Enter' && results.length > 0) {
			setQuery('');
			navigate({ to: results[0].page, search: results[0].search });
		}
	};

	const handlePointerDown = (e: React.PointerEvent<HTMLInputElement>) => {
		if (!e.currentTarget.readOnly) {
			return;
		}
		e.preventDefault();
		e.currentTarget.readOnly = false;
		e.currentTarget.focus();
	};

	return (
		<div className={cn('flex min-h-0 flex-1 flex-col', isCollapsed && 'hidden')}>
			{!isViewer && (
				<div className='px-2 pt-1 pb-2'>
					<div className='relative flex items-center'>
						<Search className='pointer-events-none absolute left-2.5 size-4 text-muted-foreground' />
						<input
							ref={inputRef}
							type='text'
							name='settings-search'
							autoComplete='off'
							placeholder='Search settings...'
							aria-label='Search settings'
							value={query}
							readOnly={!isSearchFocused}
							onPointerDown={handlePointerDown}
							onFocus={() => setIsSearchFocused(true)}
							onBlur={() => setIsSearchFocused(false)}
							onChange={(e) => setQuery(e.target.value)}
							onKeyDown={handleKeyDown}
							className='h-8 w-full rounded-md border border-sidebar-border bg-background pr-8 pl-8 text-sm shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring'
						/>
						{query ? (
							<button
								type='button'
								aria-label='Clear search'
								onClick={() => {
									setQuery('');
									inputRef.current?.focus();
								}}
								className='absolute right-2 flex cursor-pointer items-center text-muted-foreground hover:text-foreground'
							>
								<X className='size-3.5' />
							</button>
						) : (
							<kbd className='pointer-events-none absolute right-2 inline-flex h-5 min-w-5 items-center justify-center rounded-sm bg-muted px-1 font-sans text-xs text-muted-foreground'>
								/
							</kbd>
						)}
					</div>
				</div>
			)}

			{isSearching && !isViewer ? (
				<SidebarGroup>
					<SidebarMenu>
						{results.length === 0 ? (
							<div className='px-2 py-1.5 text-sm text-muted-foreground'>No results found</div>
						) : (
							results.map((result) => (
								<SidebarMenuItem key={result.page + result.title}>
									<SidebarMenuButton asChild className='h-auto flex-col items-start gap-0.5 py-1.5'>
										<Link to={result.page} search={result.search} onClick={() => setQuery('')}>
											<span className='truncate font-medium'>{result.title}</span>
											<span className='truncate text-xs text-muted-foreground'>
												{result.pageLabel}
												{result.section ? ` · ${result.section}` : ''}
											</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))
						)}
					</SidebarMenu>
				</SidebarGroup>
			) : (
				<nav aria-label='Settings'>
					{navGroups.map((group) => (
						<SidebarGroup key={group.label} className='py-1'>
							<SidebarGroupLabel>{group.label}</SidebarGroupLabel>
							<SidebarMenu>
								{group.items.map((item) => {
									const leavesSettingsIndicator = item.leavesSettings ? (
										<>
											<ArrowUpRight
												aria-hidden='true'
												className='ml-auto size-3.5! text-muted-foreground'
											/>
											<span className='sr-only'>Opens a chat outside settings</span>
										</>
									) : null;

									return (
										<SidebarMenuItem key={`${item.to}-${item.label}`}>
											<SidebarMenuButton asChild>
												{item.search ? (
													<Link
														to='/'
														search={item.search}
														activeOptions={item.exact ? { exact: true } : undefined}
														activeProps={{ 'aria-current': 'page' }}
													>
														<item.icon />
														<span>{item.label}</span>
														{leavesSettingsIndicator}
													</Link>
												) : (
													<Link
														to={item.to}
														activeOptions={item.exact ? { exact: true } : undefined}
														activeProps={{ 'aria-current': 'page' }}
													>
														<item.icon />
														<span>{item.label}</span>
														{leavesSettingsIndicator}
													</Link>
												)}
											</SidebarMenuButton>
										</SidebarMenuItem>
									);
								})}
							</SidebarMenu>
						</SidebarGroup>
					))}
				</nav>
			)}
		</div>
	);
}
