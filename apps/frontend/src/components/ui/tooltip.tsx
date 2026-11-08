import { Tooltip as TooltipPrimitive } from 'radix-ui';
import { isValidElement } from 'react';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** Hover intent before a hint shows; keyboard focus shows it at once. */
const DEFAULT_DELAY_MS = 700;

function TooltipProvider({
	delayDuration = DEFAULT_DELAY_MS,
	...props
}: ComponentProps<typeof TooltipPrimitive.Provider>) {
	return <TooltipPrimitive.Provider data-slot='tooltip-provider' delayDuration={delayDuration} {...props} />;
}

function Tooltip(props: ComponentProps<typeof TooltipPrimitive.Root>) {
	return <TooltipPrimitive.Root data-slot='tooltip' {...props} />;
}

/** Wraps its child; plain text gets a span so the trigger never turns into a nested button. */
function TooltipTrigger({ asChild: _asChild, children, ...props }: ComponentProps<typeof TooltipPrimitive.Trigger>) {
	return (
		<TooltipPrimitive.Trigger data-slot='tooltip-trigger' asChild {...props}>
			{isValidElement(children) ? children : <span>{children}</span>}
		</TooltipPrimitive.Trigger>
	);
}

function TooltipContent({
	className,
	sideOffset = 4,
	children,
	...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Content
				data-slot='tooltip-content'
				sideOffset={sideOffset}
				className={cn(
					'z-50 inline-flex w-fit max-w-xs origin-(--radix-tooltip-content-transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-balance text-background has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
					className,
				)}
				{...props}
			>
				{children}
				<TooltipPrimitive.Arrow className='z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground' />
			</TooltipPrimitive.Content>
		</TooltipPrimitive.Portal>
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
