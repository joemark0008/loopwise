import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowUpRight, Search, X } from 'lucide-react';
import { Fragment, useEffect, useRef, useState } from 'react';

import styles from './sidebar-settings-nav.module.css';
import type { NavContext } from '@/lib/navigation';
import { getVisibleSettingsNavGroups } from '@/lib/navigation';
import { useSettingsSearch } from '@/hooks/use-settings-search';
import { cn, hideIf } from '@/lib/utils';

const navRowClassName = styles.navRowClassName;

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
		<div className={cn(styles.sidebarSettingsNavDiv, hideIf(isCollapsed))}>
			{!isViewer && (
				<div className={styles.sidebarSettingsNavDiv2}>
					<div className={styles.sidebarSettingsNavDiv3}>
						<Search className={styles.sidebarSettingsNavSearch} />
						<input
							ref={inputRef}
							type='text'
							name='settings-search'
							autoComplete='off'
							placeholder='Search settings...'
							value={query}
							readOnly={!isSearchFocused}
							onPointerDown={handlePointerDown}
							onFocus={() => setIsSearchFocused(true)}
							onBlur={() => setIsSearchFocused(false)}
							onChange={(e) => setQuery(e.target.value)}
							onKeyDown={handleKeyDown}
							className={cn(
								styles.sidebarSettingsNavInput,
								styles.sidebarSettingsNavInput2,
								styles.sidebarSettingsNavInput3,
							)}
						/>
						{query ? (
							<button
								type='button'
								onClick={() => {
									setQuery('');
									inputRef.current?.focus();
								}}
								className={styles.sidebarSettingsNavButton}
							>
								<X className={styles.sidebarSettingsNavX} />
							</button>
						) : (
							<kbd className={styles.sidebarSettingsNavKbd}>/</kbd>
						)}
					</div>
				</div>
			)}

			<div className={styles.sidebarSettingsNavDiv4}>
				{isSearching && !isViewer ? (
					<div className={styles.sidebarSettingsNavDiv5}>
						{results.length === 0 ? (
							<div className={styles.sidebarSettingsNavDiv6}>No results found</div>
						) : (
							results.map((result) => (
								<Link
									key={result.page + result.title}
									to={result.page}
									search={result.search}
									onClick={() => setQuery('')}
									className={cn(styles.sidebarSettingsNavLink, styles.sidebarSettingsNavLink2)}
								>
									<span className={styles.sidebarSettingsNavSpan}>{result.title}</span>
									<span className={styles.sidebarSettingsNavSpan2}>
										{result.pageLabel}
										{result.section ? ` · ${result.section}` : ''}
									</span>
								</Link>
							))
						)}
					</div>
				) : (
					<nav className={styles.sidebarSettingsNavNav}>
						{navGroups.map((group) => (
							<Fragment key={group.label}>
								<div className={styles.sidebarSettingsNavDiv7}>{group.label}</div>
								{group.items.map((item) => {
									const leavesSettingsIndicator = item.leavesSettings ? (
										<>
											<ArrowUpRight
												aria-hidden='true'
												className={cn(
													styles.leavesSettingsIndicatorArrowUpRight,
													styles.leavesSettingsIndicatorArrowUpRight2,
												)}
											/>
											<span className='sr-only'>Opens a chat outside settings</span>
										</>
									) : null;

									return (
										<div key={`${item.to}-${item.label}`} className={styles.sidebarSettingsNavDiv8}>
											{item.search ? (
												<Link
													to='/'
													search={item.search}
													activeOptions={item.exact ? { exact: true } : undefined}
													className={navRowClassName}
													activeProps={{
														className: cn(styles.sidebarSettingsNavClassName),
													}}
													inactiveProps={{
														className: cn(styles.sidebarSettingsNavLink2),
													}}
												>
													<item.icon className={styles.navIcon} />
													<span>{item.label}</span>
													{leavesSettingsIndicator}
												</Link>
											) : (
												<Link
													to={item.to}
													activeOptions={item.exact ? { exact: true } : undefined}
													className={navRowClassName}
													activeProps={{
														className: cn(styles.sidebarSettingsNavClassName),
													}}
													inactiveProps={{
														className: cn(styles.sidebarSettingsNavLink2),
													}}
												>
													<item.icon className={styles.navIcon} />
													<span>{item.label}</span>
													{leavesSettingsIndicator}
												</Link>
											)}
										</div>
									);
								})}
							</Fragment>
						))}
					</nav>
				)}
			</div>
		</div>
	);
}
