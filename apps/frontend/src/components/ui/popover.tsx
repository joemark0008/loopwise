import { Popover as MantinePopover } from '@mantine/core';
import { cloneElement, createContext, isValidElement, useContext, useRef, useState } from 'react';

import styles from './overlay.module.css';
import { findPart, toFloatingPosition } from './floating';
import type { ComponentProps, MouseEvent, ReactElement, ReactNode } from 'react';
import type { FloatingAlign, FloatingSide } from './floating';
import { usePortalContainer } from '@/contexts/portal-container';
import { cn } from '@/lib/utils';

const PopoverContext = createContext<{
	open: boolean;
	setOpen: (open: boolean) => void;
	targetWidth?: number;
	setTargetWidth: (width?: number) => void;
}>({ open: false, setOpen: () => undefined, setTargetWidth: () => undefined });

type PopoverContentProps = ComponentProps<'div'> & {
	align?: FloatingAlign;
	side?: FloatingSide;
	sideOffset?: number;
};

function Popover({
	open,
	defaultOpen = false,
	onOpenChange,
	children,
}: {
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	children?: ReactNode;
}) {
	const [internalOpen, setInternalOpen] = useState(defaultOpen);
	const [targetWidth, setTargetWidth] = useState<number>();
	const isOpen = open ?? internalOpen;
	const content = findPart<PopoverContentProps>(children, PopoverContent);
	const portalTarget = usePortalContainer();
	const setOpen = (next: boolean) => {
		setInternalOpen(next);
		onOpenChange?.(next);
	};

	return (
		<PopoverContext.Provider value={{ open: isOpen, setOpen, targetWidth, setTargetWidth }}>
			<MantinePopover
				opened={isOpen}
				onChange={setOpen}
				position={toFloatingPosition(content?.side, content?.align)}
				offset={content?.sideOffset ?? 4}
				withinPortal
				portalProps={portalTarget ? { target: portalTarget } : undefined}
				transitionProps={{ duration: 160, transition: 'pop' }}
			>
				{children}
			</MantinePopover>
		</PopoverContext.Provider>
	);
}

function PopoverTrigger({ asChild, children, ...props }: ComponentProps<'button'> & { asChild?: boolean }) {
	const { open, setOpen, setTargetWidth } = useContext(PopoverContext);
	const ref = useRef<HTMLElement>(null);
	const toggle = (event: MouseEvent<HTMLElement>) => {
		setTargetWidth(event.currentTarget.offsetWidth);
		setOpen(!open);
	};
	if (asChild && isValidElement(children)) {
		const child = children as ReactElement<ComponentProps<'button'>>;
		return (
			<MantinePopover.Target ref={ref as never}>
				{cloneElement(child, {
					...props,
					'data-state': open ? 'open' : 'closed',
					onClick: (event: MouseEvent<HTMLButtonElement>) => {
						child.props.onClick?.(event);
						toggle(event);
					},
				} as ComponentProps<'button'>)}
			</MantinePopover.Target>
		);
	}
	return (
		<MantinePopover.Target>
			<button type='button' data-state={open ? 'open' : 'closed'} onClick={toggle} {...props}>
				{children}
			</button>
		</MantinePopover.Target>
	);
}

function PopoverAnchor({ children }: { asChild?: boolean; children?: ReactNode }) {
	return <MantinePopover.Target>{children as ReactElement}</MantinePopover.Target>;
}

function PopoverContent({
	className,
	style,
	align: _align,
	side: _side,
	sideOffset: _sideOffset,
	...props
}: PopoverContentProps) {
	const { targetWidth } = useContext(PopoverContext);
	return (
		<MantinePopover.Dropdown
			data-slot='popover-content'
			className={cn(styles.floating, styles.popover, className)}
			style={{ ...style, ['--popover-trigger-width' as string]: targetWidth ? `${targetWidth}px` : undefined }}
			{...(props as object)}
		/>
	);
}

export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger };
