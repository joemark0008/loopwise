import { Tooltip as MantineTooltip } from '@mantine/core';
import { Children, cloneElement, createContext, isValidElement, useContext, useEffect, useRef, useState } from 'react';

import styles from './overlay.module.css';
import { toFloatingPosition } from './floating';
import type { ComponentProps, FocusEvent, PointerEvent, ReactElement, ReactNode } from 'react';
import type { FloatingAlign, FloatingSide } from './floating';
import { cn } from '@/lib/utils';

const DEFAULT_DELAY_MS = 700;
const DelayContext = createContext(DEFAULT_DELAY_MS);

function TooltipProvider({
	delayDuration = DEFAULT_DELAY_MS,
	children,
}: {
	delayDuration?: number;
	children?: ReactNode;
}) {
	return <DelayContext.Provider value={delayDuration}>{children}</DelayContext.Provider>;
}

type TriggerHandlers = {
	onPointerMove?: (event: PointerEvent) => void;
	onPointerLeave?: (event: PointerEvent) => void;
	onFocus?: (event: FocusEvent) => void;
	onBlur?: (event: FocusEvent) => void;
};

function TooltipTrigger({ children }: { asChild?: boolean; children?: ReactNode }) {
	return <>{children}</>;
}

type TooltipContentProps = {
	side?: FloatingSide;
	align?: FloatingAlign;
	sideOffset?: number;
	className?: string;
	children?: ReactNode;
};

function TooltipContent({ children }: TooltipContentProps) {
	return <>{children}</>;
}

function Tooltip({
	open,
	onOpenChange,
	delayDuration,
	children,
}: {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	delayDuration?: number;
	children?: ReactNode;
}) {
	const providerDelay = useContext(DelayContext);
	const delay = delayDuration ?? providerDelay;
	const [internalOpen, setInternalOpen] = useState(false);
	const timer = useRef<number>(undefined);
	const isPending = useRef(false);
	const isOpen = open ?? internalOpen;

	useEffect(() => () => window.clearTimeout(timer.current), []);

	const parts = Children.toArray(children).filter(isValidElement) as ReactElement[];
	const trigger = parts.find((part) => part.type === TooltipTrigger) as
		ReactElement<{ asChild?: boolean; children?: ReactNode }> | undefined;
	const content = parts.find((part) => part.type === TooltipContent) as ReactElement<TooltipContentProps> | undefined;
	const triggerChild = trigger?.props.children;
	if (!trigger) {
		return null;
	}
	const target = isValidElement(triggerChild) ? (
		(triggerChild as ReactElement<TriggerHandlers>)
	) : (
		<span>{triggerChild}</span>
	);

	const setOpen = (next: boolean) => {
		setInternalOpen(next);
		onOpenChange?.(next);
	};
	const show = (immediate = false) => {
		window.clearTimeout(timer.current);
		if (immediate || delay === 0) {
			setOpen(true);
			return;
		}
		timer.current = window.setTimeout(() => setOpen(true), delay);
	};
	const hide = () => {
		isPending.current = false;
		window.clearTimeout(timer.current);
		setOpen(false);
	};

	const childProps = (target as ReactElement<TriggerHandlers>).props;
	const withHandlers = cloneElement(target as ReactElement<TriggerHandlers>, {
		onPointerMove: (event: PointerEvent) => {
			childProps.onPointerMove?.(event);
			if (event.pointerType !== 'touch' && !isOpen && !isPending.current) {
				isPending.current = true;
				show();
			}
		},
		onPointerLeave: (event: PointerEvent) => {
			childProps.onPointerLeave?.(event);
			hide();
		},
		onFocus: (event: FocusEvent) => {
			childProps.onFocus?.(event);
			show(true);
		},
		onBlur: (event: FocusEvent) => {
			childProps.onBlur?.(event);
			hide();
		},
	});

	if (!content) {
		return withHandlers;
	}

	return (
		<MantineTooltip
			opened={isOpen}
			label={content.props.children}
			position={toFloatingPosition(content.props.side ?? 'top', content.props.align)}
			offset={content.props.sideOffset ?? 4}
			classNames={{ tooltip: cn(styles.tooltip, content.props.className) }}
			data-slot='tooltip-content'
			data-side={content.props.side ?? 'top'}
			data-align={content.props.align ?? 'center'}
			multiline
			withinPortal
			transitionProps={{ duration: 90, transition: 'fade' }}
		>
			{withHandlers}
		</MantineTooltip>
	);
}

function SimpleTooltip({
	content,
	children,
	side,
	align,
}: {
	content: ReactNode;
	children: ReactNode;
	side?: ComponentProps<typeof TooltipContent>['side'];
	align?: ComponentProps<typeof TooltipContent>['align'];
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent side={side} align={align}>
				{content}
			</TooltipContent>
		</Tooltip>
	);
}

export { SimpleTooltip, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
