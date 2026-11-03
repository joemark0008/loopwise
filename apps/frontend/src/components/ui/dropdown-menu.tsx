import { Menu } from '@mantine/core';
import { CheckIcon, ChevronRightIcon, CircleIcon } from 'lucide-react';
import { cloneElement, createContext, isValidElement, useContext, useEffect, useRef, useState } from 'react';

import styles from './overlay.module.css';
import { findPart, toFloatingPosition } from './floating';
import type { ComponentProps, MouseEvent, ReactElement, ReactNode } from 'react';
import type { FloatingAlign, FloatingSide } from './floating';
import { usePortalContainer } from '@/contexts/portal-container';
import { cn } from '@/lib/utils';

interface MenuContextValue {
	close: () => void;
	open: boolean;
}

const MenuContext = createContext<MenuContextValue>({ close: () => undefined, open: false });
const RadioContext = createContext<{ value?: string; onValueChange?: (value: string) => void }>({});

/** The event handed to `onSelect`: preventing its default keeps the menu open. */
interface MenuSelectEvent {
	preventDefault: () => void;
	defaultPrevented: boolean;
}

function createSelectEvent(): MenuSelectEvent {
	const event: MenuSelectEvent = {
		defaultPrevented: false,
		preventDefault: () => {
			event.defaultPrevented = true;
		},
	};
	return event;
}

type ContentProps = Omit<ComponentProps<'div'>, 'onClick'> & {
	side?: FloatingSide;
	align?: FloatingAlign;
	sideOffset?: number;
	collisionPadding?: number;
	onClick?: ComponentProps<'div'>['onClick'];
	onCloseAutoFocus?: (event: { preventDefault: () => void }) => void;
	onInteractOutside?: () => void;
};

function DropdownMenu({
	open,
	defaultOpen = false,
	onOpenChange,
	children,
}: {
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	modal?: boolean;
	children?: ReactNode;
}) {
	const [internalOpen, setInternalOpen] = useState(defaultOpen);
	const isOpen = open ?? internalOpen;
	const content = findPart<ContentProps>(children, DropdownMenuContent);
	const portalTarget = usePortalContainer();
	const setOpen = (next: boolean) => {
		setInternalOpen(next);
		onOpenChange?.(next);
	};

	return (
		<MenuContext.Provider value={{ close: () => setOpen(false), open: isOpen }}>
			<Menu
				opened={isOpen}
				onChange={setOpen}
				onClose={() => {
					const callback = content?.onCloseAutoFocus;
					if (callback) {
						requestAnimationFrame(() => callback({ preventDefault: () => undefined }));
					}
				}}
				position={toFloatingPosition(content?.side, content?.align)}
				offset={content?.sideOffset ?? 4}
				closeOnItemClick={false}
				returnFocus={!content?.onCloseAutoFocus}
				withinPortal
				portalProps={portalTarget ? { target: portalTarget } : undefined}
				transitionProps={{ duration: 160, transition: 'pop' }}
				shadow='md'
			>
				{children}
			</Menu>
		</MenuContext.Provider>
	);
}

function DropdownMenuTrigger({
	asChild,
	children,
	...props
}: ComponentProps<'button'> & { asChild?: boolean; children?: ReactNode }) {
	const { open } = useContext(MenuContext);
	const state = open ? 'open' : 'closed';
	if (asChild && isValidElement(children)) {
		const child = children as ReactElement<Record<string, unknown>>;
		return <Menu.Target>{cloneElement(child, { 'data-state': state, ...props })}</Menu.Target>;
	}
	return (
		<Menu.Target>
			<button type='button' data-slot='dropdown-menu-trigger' data-state={state} {...props}>
				{children}
			</button>
		</Menu.Target>
	);
}

function DropdownMenuContent({
	className,
	side = 'bottom',
	align = 'center',
	sideOffset: _sideOffset,
	collisionPadding: _collisionPadding,
	onCloseAutoFocus: _onCloseAutoFocus,
	onInteractOutside,
	...props
}: ContentProps) {
	const ref = useRef<HTMLDivElement>(null);
	const ariaLabel = props['aria-label'];

	const { open } = useContext(MenuContext);

	// Mantine names the dropdown after its target, which would hide an explicit label. It mounts when opened.
	useEffect(() => {
		if (!ariaLabel || !open) {
			return;
		}
		const applyLabel = () => {
			ref.current?.removeAttribute('aria-labelledby');
			ref.current?.setAttribute('aria-label', ariaLabel);
		};
		applyLabel();
		const frame = requestAnimationFrame(applyLabel);
		return () => cancelAnimationFrame(frame);
	}, [ariaLabel, open]);

	useEffect(() => {
		if (!onInteractOutside) {
			return;
		}
		const handlePointerDown = (event: PointerEvent) => {
			if (!ref.current?.contains(event.target as Node)) {
				onInteractOutside();
			}
		};
		document.addEventListener('pointerdown', handlePointerDown, true);
		return () => document.removeEventListener('pointerdown', handlePointerDown, true);
	}, [onInteractOutside]);

	return (
		<Menu.Dropdown
			ref={ref}
			data-slot='dropdown-menu-content'
			data-side={side}
			data-align={align}
			className={cn(styles.floating, styles.menu, className)}
			{...(props as object)}
		/>
	);
}

function DropdownMenuGroup({ ...props }: ComponentProps<'div'>) {
	return <div role='group' {...props} />;
}

type ItemProps = Omit<ComponentProps<'button'>, 'onSelect'> & {
	inset?: boolean;
	variant?: 'default' | 'destructive';
	onSelect?: (event: MenuSelectEvent) => void;
};

function useItemClick(onClick: ItemProps['onClick'], onSelect: ItemProps['onSelect'], afterSelect?: () => void) {
	const { close } = useContext(MenuContext);
	return (event: MouseEvent<HTMLButtonElement>) => {
		onClick?.(event);
		const selectEvent = createSelectEvent();
		onSelect?.(selectEvent);
		afterSelect?.();
		if (!selectEvent.defaultPrevented) {
			close();
		}
	};
}

const itemClassNames = { itemLabel: styles.menuItemLabel };

/** Mantine fixes the role on its menu item, so the selectable kinds set theirs on the rendered button. */
const renderAs = (role: 'menuitemcheckbox' | 'menuitemradio') =>
	function SelectableItemRoot(props: ComponentProps<'button'>) {
		return <button {...props} role={role} />;
	};
const renderCheckboxItem = renderAs('menuitemcheckbox');
const renderRadioItem = renderAs('menuitemradio');

function DropdownMenuItem({ className, inset, variant = 'default', onClick, onSelect, children, ...props }: ItemProps) {
	const handleClick = useItemClick(onClick, onSelect);
	return (
		<Menu.Item
			data-slot='dropdown-menu-item'
			data-variant={variant}
			className={cn(styles.menuItem, inset && styles.menuItemInset, className)}
			classNames={itemClassNames}
			onClick={handleClick}
			{...(props as object)}
		>
			{children}
		</Menu.Item>
	);
}

function DropdownMenuCheckboxItem({
	className,
	children,
	checked,
	onCheckedChange,
	onClick,
	onSelect,
	...props
}: ItemProps & { checked?: boolean; onCheckedChange?: (checked: boolean) => void }) {
	const handleClick = useItemClick(onClick, onSelect, () => onCheckedChange?.(!checked));
	return (
		<Menu.Item
			renderRoot={renderCheckboxItem}
			aria-checked={checked}
			aria-disabled={props.disabled || undefined}
			data-slot='dropdown-menu-checkbox-item'
			className={cn(styles.menuItem, styles.menuItemSelectable, className)}
			classNames={itemClassNames}
			onClick={handleClick}
			{...(props as object)}
		>
			<span className={styles.menuIndicator}>{checked && <CheckIcon />}</span>
			{children}
		</Menu.Item>
	);
}

function DropdownMenuRadioGroup({
	value,
	onValueChange,
	...props
}: Omit<ComponentProps<'div'>, 'onChange'> & { value?: string; onValueChange?: (value: string) => void }) {
	return (
		<RadioContext.Provider value={{ value, onValueChange }}>
			<div role='group' {...props} />
		</RadioContext.Provider>
	);
}

function DropdownMenuRadioItem({
	className,
	children,
	indicator = 'dot',
	value,
	onClick,
	onSelect,
	...props
}: Omit<ItemProps, 'value'> & { value: string; indicator?: 'dot' | 'check' }) {
	const radio = useContext(RadioContext);
	const checked = radio.value === value;
	const handleClick = useItemClick(onClick, onSelect, () => radio.onValueChange?.(value));
	return (
		<Menu.Item
			renderRoot={renderRadioItem}
			aria-checked={checked}
			aria-disabled={props.disabled || undefined}
			data-slot='dropdown-menu-radio-item'
			className={cn(styles.menuItem, styles.menuItemSelectable, className)}
			classNames={itemClassNames}
			onClick={handleClick}
			{...(props as object)}
		>
			<span className={styles.menuIndicator}>
				{checked && (indicator === 'check' ? <CheckIcon /> : <CircleIcon data-dot />)}
			</span>
			{children}
		</Menu.Item>
	);
}

function DropdownMenuLabel({ className, inset, ...props }: ComponentProps<'div'> & { inset?: boolean }) {
	return (
		<div
			data-slot='dropdown-menu-label'
			className={cn(styles.menuLabel, inset && styles.menuItemInset, className)}
			{...props}
		/>
	);
}

function DropdownMenuSeparator({ className, ...props }: ComponentProps<'div'>) {
	return (
		<div
			role='separator'
			data-slot='dropdown-menu-separator'
			className={cn(styles.menuSeparator, className)}
			{...props}
		/>
	);
}

function DropdownMenuShortcut({ className, ...props }: ComponentProps<'span'>) {
	return <span data-slot='dropdown-menu-shortcut' className={cn(styles.menuShortcut, className)} {...props} />;
}

function DropdownMenuSub({ children }: { children?: ReactNode }) {
	return (
		<Menu.Sub position='right-start' offset={4}>
			{children}
		</Menu.Sub>
	);
}

function DropdownMenuSubTrigger({
	className,
	inset,
	children,
	...props
}: ComponentProps<'button'> & { inset?: boolean }) {
	return (
		<Menu.Sub.Target>
			<Menu.Sub.Item
				data-slot='dropdown-menu-sub-trigger'
				className={cn(styles.menuItem, inset && styles.menuItemInset, className)}
				classNames={itemClassNames}
				{...(props as object)}
			>
				{children}
				<ChevronRightIcon className={styles.subChevron} />
			</Menu.Sub.Item>
		</Menu.Sub.Target>
	);
}

function DropdownMenuSubContent({
	className,
	sideOffset: _sideOffset,
	alignOffset: _alignOffset,
	...props
}: ComponentProps<'div'> & { sideOffset?: number; alignOffset?: number }) {
	return (
		<Menu.Sub.Dropdown
			data-slot='dropdown-menu-sub-content'
			data-side='right'
			data-align='start'
			className={cn(styles.floating, styles.menu, className)}
			{...(props as object)}
		/>
	);
}

export {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
};
