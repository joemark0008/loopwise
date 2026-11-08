import { Accordion as AccordionPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

function Accordion({ className, ...props }: ComponentProps<typeof AccordionPrimitive.Root>) {
	return (
		<AccordionPrimitive.Root data-slot='accordion' className={cn('flex w-full flex-col', className)} {...props} />
	);
}

function AccordionItem({ className, ...props }: ComponentProps<typeof AccordionPrimitive.Item>) {
	return (
		<AccordionPrimitive.Item data-slot='accordion-item' className={cn('not-last:border-b', className)} {...props} />
	);
}

/** The trigger carries no chevron of its own: callers place the icon that fits their row. */
function AccordionTrigger({
	className,
	headerClassName,
	...props
}: ComponentProps<typeof AccordionPrimitive.Trigger> & { headerClassName?: string }) {
	return (
		<AccordionPrimitive.Header className={cn('flex w-full min-w-0 overflow-hidden', headerClassName)}>
			<AccordionPrimitive.Trigger
				data-slot='accordion-trigger'
				className={cn(
					'group/accordion-trigger flex min-w-0 flex-1 items-start gap-4 overflow-hidden rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
					className,
				)}
				{...props}
			/>
		</AccordionPrimitive.Header>
	);
}

function AccordionContent({ className, children, ...props }: ComponentProps<typeof AccordionPrimitive.Content>) {
	return (
		<AccordionPrimitive.Content
			data-slot='accordion-content'
			className='overflow-hidden text-sm data-open:animate-accordion-down data-closed:animate-accordion-up'
			{...props}
		>
			<div className={cn('pb-4', className)}>{children}</div>
		</AccordionPrimitive.Content>
	);
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
