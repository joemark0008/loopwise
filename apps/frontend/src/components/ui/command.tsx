import { SearchIcon } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import styles from './overlay.module.css';
import type { ComponentProps, KeyboardEvent, ReactNode } from 'react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface CommandContextValue {
	search: string;
	setSearch: (search: string) => void;
	shouldFilter: boolean;
	selected: string | null;
	setSelected: (value: string) => void;
	hasItems: boolean;
}

const CommandContext = createContext<CommandContextValue | null>(null);

function useCommandContext() {
	const context = useContext(CommandContext);
	if (!context) {
		throw new Error('Command parts must be used within a Command');
	}
	return context;
}

const ITEM_SELECTOR = '[data-command-item]:not([data-disabled="true"])';

function Command({
	className,
	shouldFilter = true,
	loop = false,
	children,
	onKeyDown,
	...props
}: ComponentProps<'div'> & { shouldFilter?: boolean; loop?: boolean }) {
	const [search, setSearch] = useState('');
	const [selected, setSelected] = useState<string | null>(null);
	const [hasItems, setHasItems] = useState(true);
	const rootRef = useRef<HTMLDivElement>(null);

	const items = () => [...(rootRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? [])];

	// The list changes with the search and with the caller's data, so keep the selection on an item that exists.
	useLayoutEffect(() => {
		const current = items();
		setHasItems(current.length > 0);
		if (!current.some((item) => item.dataset.value === selected)) {
			setSelected(current[0]?.dataset.value ?? null);
		}
	}, [children, search, selected]);

	const move = (delta: 1 | -1) => {
		const current = items();
		if (current.length === 0) {
			return;
		}
		const index = current.findIndex((item) => item.dataset.value === selected);
		let next = index + delta;
		if (loop) {
			next = (next + current.length) % current.length;
		} else {
			next = Math.min(Math.max(next, 0), current.length - 1);
		}
		const item = current[next];
		setSelected(item.dataset.value ?? null);
		item.scrollIntoView?.({ block: 'nearest' });
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		onKeyDown?.(event);
		if (event.defaultPrevented) {
			return;
		}
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			move(1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			move(-1);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			items()
				.find((item) => item.dataset.value === selected)
				?.click();
		}
	};

	const value = useMemo(
		() => ({ search, setSearch, shouldFilter, selected, setSelected, hasItems }),
		[search, shouldFilter, selected, hasItems],
	);

	return (
		<CommandContext.Provider value={value}>
			<div
				ref={rootRef}
				data-slot='command'
				className={cn(styles.command, className)}
				onKeyDown={handleKeyDown}
				{...props}
			>
				{children}
			</div>
		</CommandContext.Provider>
	);
}

function CommandDialog({
	children,
	shouldFilter,
	loop,
	open,
	onOpenChange,
}: {
	children?: ReactNode;
	shouldFilter?: boolean;
	loop?: boolean;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className={styles.commandDialog} showCloseButton={false}>
				<DialogTitle className='sr-only'>Command Menu</DialogTitle>
				<Command shouldFilter={shouldFilter} loop={loop}>
					{children}
				</Command>
			</DialogContent>
		</Dialog>
	);
}

function CommandInput({
	className,
	value,
	onValueChange,
	...props
}: Omit<ComponentProps<'input'>, 'value' | 'onChange'> & { value?: string; onValueChange?: (value: string) => void }) {
	const { search, setSearch } = useCommandContext();
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	return (
		<div data-slot='command-input-wrapper' className={styles.commandInputRow}>
			<SearchIcon />
			<input
				ref={inputRef}
				data-slot='command-input'
				autoComplete='off'
				className={cn(styles.commandInput, className)}
				value={value ?? search}
				onChange={(event) => {
					setSearch(event.target.value);
					onValueChange?.(event.target.value);
				}}
				{...props}
			/>
		</div>
	);
}

function CommandList({ className, ...props }: ComponentProps<'div'>) {
	return <div role='listbox' data-slot='command-list' className={cn(styles.commandList, className)} {...props} />;
}

function CommandEmpty({ className, ...props }: ComponentProps<'div'>) {
	const { hasItems, shouldFilter } = useCommandContext();
	if (shouldFilter && hasItems) {
		return null;
	}
	return <div data-slot='command-empty' className={cn(styles.commandEmpty, className)} {...props} />;
}

function CommandGroup({
	className,
	heading,
	children,
	...props
}: Omit<ComponentProps<'div'>, 'heading'> & { heading?: ReactNode }) {
	return (
		<div role='group' data-slot='command-group' className={cn(styles.commandGroup, className)} {...props}>
			{heading && <div className={styles.commandHeading}>{heading}</div>}
			{children}
		</div>
	);
}

function CommandSeparator({ className, ...props }: ComponentProps<'div'>) {
	return (
		<div
			role='separator'
			data-slot='command-separator'
			className={cn(styles.commandSeparator, className)}
			{...props}
		/>
	);
}

function CommandItem({
	className,
	value,
	keywords,
	disabled,
	onSelect,
	children,
	...props
}: Omit<ComponentProps<'div'>, 'onSelect'> & {
	value: string;
	keywords?: string[];
	disabled?: boolean;
	onSelect?: (value: string) => void;
}) {
	const { search, shouldFilter, selected, setSelected } = useCommandContext();
	const handleSelect = useCallback(() => onSelect?.(value), [onSelect, value]);

	if (shouldFilter && search.trim()) {
		const haystack = [value, ...(keywords ?? [])].join(' ').toLowerCase();
		if (!haystack.includes(search.trim().toLowerCase())) {
			return null;
		}
	}

	return (
		<div
			role='option'
			aria-selected={selected === value}
			data-command-item
			data-slot='command-item'
			data-value={value}
			data-selected={selected === value}
			data-disabled={disabled ? 'true' : undefined}
			className={cn(styles.commandItem, className)}
			onMouseMove={() => setSelected(value)}
			onClick={handleSelect}
			{...props}
		>
			{children}
		</div>
	);
}

function CommandShortcut({ className, ...props }: ComponentProps<'span'>) {
	return <span data-slot='command-shortcut' className={cn(styles.commandShortcut, className)} {...props} />;
}

export {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
};
