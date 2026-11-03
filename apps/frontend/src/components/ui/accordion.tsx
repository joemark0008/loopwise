import { createContext, useContext } from 'react';
import styles from './overlay.module.css';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

const AccordionContext = createContext<{
	isOpen: (item: string) => boolean;
	toggle: (item: string) => void;
	disabled?: boolean;
}>({ isOpen: () => false, toggle: () => undefined });
const AccordionItemContext = createContext('');

type AccordionProps = Omit<ComponentProps<'div'>, 'defaultValue'> & { disabled?: boolean } & (
		| { type?: 'single'; collapsible?: boolean; value?: string; onValueChange?: (value: string) => void }
		| { type: 'multiple'; collapsible?: boolean; value?: string[]; onValueChange?: (value: string[]) => void }
	);

function Accordion({
	type = 'single',
	value,
	onValueChange,
	disabled,
	collapsible: _collapsible,
	...props
}: AccordionProps) {
	const open = Array.isArray(value) ? value : value ? [value] : [];
	const toggle = (item: string) => {
		const isOpen = open.includes(item);
		if (type === 'multiple') {
			(onValueChange as ((next: string[]) => void) | undefined)?.(
				isOpen ? open.filter((entry) => entry !== item) : [...open, item],
			);
			return;
		}
		(onValueChange as ((next: string) => void) | undefined)?.(isOpen ? '' : item);
	};
	return (
		<AccordionContext.Provider value={{ isOpen: (item) => open.includes(item), toggle, disabled }}>
			<div data-slot='accordion' {...props} />
		</AccordionContext.Provider>
	);
}

function AccordionItem({ className, value, ...props }: ComponentProps<'div'> & { value: string }) {
	return (
		<AccordionItemContext.Provider value={value}>
			<div data-slot='accordion-item' className={cn(styles.accordionItem, className)} {...props} />
		</AccordionItemContext.Provider>
	);
}

function AccordionTrigger({
	className,
	headerClassName,
	onClick,
	...props
}: ComponentProps<'button'> & { headerClassName?: string }) {
	const accordion = useContext(AccordionContext);
	const itemValue = useContext(AccordionItemContext);
	const isOpen = accordion.isOpen(itemValue);
	return (
		<h3 className={cn(styles.accordionHeader, headerClassName ?? styles.accordionHeaderFull)}>
			<button
				type='button'
				data-slot='accordion-trigger'
				data-state={isOpen ? 'open' : 'closed'}
				aria-expanded={isOpen}
				disabled={accordion.disabled}
				className={cn(styles.accordionTrigger, className)}
				onClick={(event) => {
					onClick?.(event);
					accordion.toggle(itemValue);
				}}
				{...props}
			/>
		</h3>
	);
}

function AccordionContent({ className, children, ...props }: ComponentProps<'div'>) {
	const accordion = useContext(AccordionContext);
	const itemValue = useContext(AccordionItemContext);
	if (!accordion.isOpen(itemValue)) {
		return <div data-slot='accordion-content' data-state='closed' hidden {...props} />;
	}
	return (
		<div data-slot='accordion-content' data-state='open' className={styles.accordionContent} {...props}>
			<div className={cn(styles.accordionContentInner, className)}>{children}</div>
		</div>
	);
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
