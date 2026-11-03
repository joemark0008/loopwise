import { Combobox, useCombobox } from '@mantine/core';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';

import styles from './overlay.module.css';
import { findPart, toFloatingPosition } from './floating';
import type { ComponentProps, ReactNode } from 'react';
import type { FloatingAlign, FloatingSide } from './floating';
import { usePortalContainer } from '@/contexts/portal-container';
import { cn } from '@/lib/utils';

interface SelectContextValue {
	value?: string;
	label: ReactNode;
	registerItem: (value: string, label: ReactNode) => () => void;
	store: ReturnType<typeof useCombobox>;
	disabled?: boolean;
	triggerWidth: number | undefined;
	triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const SelectContext = createContext<SelectContextValue | null>(null);

/** Closed dropdowns aren't in the DOM, so a hidden pass over the items gives the trigger its label. */
const RegistrationPassContext = createContext(false);

function useSelectContext() {
	const context = useContext(SelectContext);
	if (!context) {
		throw new Error('Select parts must be used within a Select');
	}
	return context;
}

type SelectContentProps = ComponentProps<'div'> & {
	align?: FloatingAlign;
	side?: FloatingSide;
	position?: 'popper' | 'item-aligned';
	collisionPadding?: number;
};

function Select({
	value,
	defaultValue,
	onValueChange,
	onOpenChange,
	disabled,
	children,
}: {
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
	onOpenChange?: (open: boolean) => void;
	disabled?: boolean;
	children?: ReactNode;
}) {
	const [internalValue, setInternalValue] = useState(defaultValue);
	const [labels, setLabels] = useState<Record<string, ReactNode>>({});
	const [triggerWidth, setTriggerWidth] = useState<number>();
	const triggerRef = useRef<HTMLButtonElement>(null);
	const currentValue = value ?? internalValue;
	const content = findPart<SelectContentProps>(children, SelectContent);
	const portalTarget = usePortalContainer();

	const store = useCombobox({
		onDropdownOpen: () => {
			setTriggerWidth(triggerRef.current?.offsetWidth);
			store.updateSelectedOptionIndex('active');
			onOpenChange?.(true);
		},
		onDropdownClose: () => {
			store.resetSelectedOption();
			onOpenChange?.(false);
		},
	});

	const registerItem = useCallback((itemValue: string, label: ReactNode) => {
		setLabels((current) => (current[itemValue] === label ? current : { ...current, [itemValue]: label }));
		return () => undefined;
	}, []);

	const contextValue = useMemo(
		() => ({
			value: currentValue,
			label: currentValue === undefined ? undefined : labels[currentValue],
			registerItem,
			store,
			disabled,
			triggerWidth,
			triggerRef,
		}),
		[currentValue, labels, registerItem, store, disabled, triggerWidth],
	);

	return (
		<SelectContext.Provider value={contextValue}>
			<Combobox
				store={store}
				keepMounted={false}
				width='max-content'
				position={toFloatingPosition(content?.side, content?.align ?? 'start')}
				offset={4}
				withinPortal
				portalProps={portalTarget ? { target: portalTarget } : undefined}
				transitionProps={{ duration: 160, transition: 'pop' }}
				onOptionSubmit={(next) => {
					setInternalValue(next);
					onValueChange?.(next);
					store.closeDropdown();
				}}
			>
				{children}
			</Combobox>
		</SelectContext.Provider>
	);
}

function SelectGroup({ ...props }: ComponentProps<'div'>) {
	return <div role='group' {...props} />;
}

function SelectValue({ placeholder, children }: { placeholder?: ReactNode; children?: ReactNode }) {
	const { label, value } = useSelectContext();
	const hasValue = value !== undefined && value !== '';
	return (
		<span data-slot='select-value' className={styles.selectValue}>
			{children ?? (hasValue ? label : placeholder)}
		</span>
	);
}

function SelectTrigger({
	className,
	size = 'default',
	variant = 'default',
	children,
	...props
}: ComponentProps<'button'> & {
	size?: 'sm' | 'default' | 'input';
	variant?: 'default' | 'ghost';
}) {
	const { store, disabled, value, triggerRef } = useSelectContext();
	// A combobox always states whether its list is open (ARIA). Mantine drops the attribute while closed, so it's set
	// on the element after each render.
	useLayoutEffect(() => {
		triggerRef.current?.setAttribute('aria-expanded', String(store.dropdownOpened));
	});
	return (
		<Combobox.Target targetType='button' refProp='ref'>
			<button
				ref={triggerRef}
				type='button'
				role='combobox'
				disabled={disabled}
				data-slot='select-trigger'
				data-size={size}
				data-variant={variant}
				data-placeholder={value === undefined || value === '' ? '' : undefined}
				data-state={store.dropdownOpened ? 'open' : 'closed'}
				className={cn(
					styles.selectTrigger,
					variant === 'default' ? styles.selectTriggerOutlined : styles.selectTriggerGhost,
					size === 'sm' && styles.selectTriggerSmall,
					size === 'input' && styles.selectTriggerInput,
					className,
				)}
				onClick={() => store.toggleDropdown()}
				{...props}
			>
				{children}
				<ChevronDownIcon className={styles.selectChevron} />
			</button>
		</Combobox.Target>
	);
}

function SelectContent({
	className,
	children,
	style,
	align: _align,
	side: _side,
	position: _position,
	collisionPadding: _collisionPadding,
	...props
}: SelectContentProps) {
	const { triggerWidth } = useSelectContext();
	return (
		<>
			<RegistrationPassContext.Provider value>
				<div hidden>{children}</div>
			</RegistrationPassContext.Provider>
			<Combobox.Dropdown
				data-slot='select-content'
				className={cn(styles.floating, styles.selectContent, className)}
				style={{ ...style, minWidth: triggerWidth }}
				{...(props as object)}
			>
				<Combobox.Options>{children}</Combobox.Options>
			</Combobox.Dropdown>
		</>
	);
}

function SelectLabel({ className, ...props }: ComponentProps<'div'>) {
	if (useContext(RegistrationPassContext)) {
		return null;
	}
	return <div data-slot='select-label' className={cn(styles.selectLabel, className)} {...props} />;
}

function SelectItem({
	className,
	children,
	value,
	disabled,
	...props
}: Omit<ComponentProps<'div'>, 'value'> & { value: string; disabled?: boolean }) {
	const { value: selected, registerItem } = useSelectContext();
	const isSelected = selected === value;

	const isRegistrationPass = useContext(RegistrationPassContext);

	useLayoutEffect(() => registerItem(value, children), [registerItem, value, children]);

	if (isRegistrationPass) {
		return null;
	}

	return (
		<Combobox.Option
			value={value}
			disabled={disabled}
			active={isSelected}
			data-slot='select-item'
			className={cn(styles.selectItem, className)}
			{...(props as object)}
		>
			<span className={styles.selectItemText}>{children}</span>
			<span data-slot='select-item-indicator' className={styles.menuIndicator}>
				{isSelected && <CheckIcon />}
			</span>
		</Combobox.Option>
	);
}

function SelectSeparator({ className, ...props }: ComponentProps<'div'>) {
	if (useContext(RegistrationPassContext)) {
		return null;
	}
	return (
		<div
			role='separator'
			data-slot='select-separator'
			className={cn(styles.selectSeparator, className)}
			{...props}
		/>
	);
}

export { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue };
