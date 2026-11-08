import { Command as CommandPrimitive } from 'cmdk';
import { SearchIcon } from 'lucide-react';
import type { ComponentProps } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/** A plain substring match on the value and keywords: predictable for patient names and clinic codes. */
function substringFilter(value: string, search: string, keywords?: string[]) {
	const query = search.trim().toLowerCase();
	if (!query) {
		return 1;
	}
	return [value, ...(keywords ?? [])].join(' ').toLowerCase().includes(query) ? 1 : 0;
}

function Command({ className, filter = substringFilter, ...props }: ComponentProps<typeof CommandPrimitive>) {
	return (
		<CommandPrimitive
			data-slot='command'
			filter={filter}
			className={cn(
				'flex size-full flex-col overflow-hidden rounded-xl bg-popover p-1 text-popover-foreground',
				className,
			)}
			{...props}
		/>
	);
}

function CommandDialog({
	title = 'Command menu',
	description = 'Find a patient, a page or an action.',
	children,
	className,
	showCloseButton = false,
	shouldFilter,
	loop,
	...props
}: ComponentProps<typeof Dialog> & {
	title?: string;
	description?: string;
	className?: string;
	showCloseButton?: boolean;
	shouldFilter?: boolean;
	loop?: boolean;
}) {
	return (
		<Dialog {...props}>
			<DialogContent
				className={cn('top-1/3 translate-y-0 overflow-hidden rounded-xl p-0 sm:max-w-xl', className)}
				showCloseButton={showCloseButton}
			>
				<DialogHeader className='sr-only'>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<Command shouldFilter={shouldFilter} loop={loop}>
					{children}
				</Command>
			</DialogContent>
		</Dialog>
	);
}

function CommandInput({ className, ...props }: ComponentProps<typeof CommandPrimitive.Input>) {
	return (
		<div data-slot='command-input-wrapper' className='p-1 pb-0'>
			<div className='flex h-9 items-center gap-2 rounded-lg border border-input/30 bg-input/30 px-2.5'>
				<SearchIcon className='size-4 shrink-0 opacity-50' />
				<CommandPrimitive.Input
					data-slot='command-input'
					autoFocus
					className={cn(
						'w-full bg-transparent text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
						className,
					)}
					{...props}
				/>
			</div>
		</div>
	);
}

function CommandList({ className, ...props }: ComponentProps<typeof CommandPrimitive.List>) {
	return (
		<CommandPrimitive.List
			data-slot='command-list'
			className={cn(
				'no-scrollbar max-h-80 scroll-py-1 overflow-x-hidden overflow-y-auto outline-none',
				className,
			)}
			{...props}
		/>
	);
}

function CommandEmpty({ className, ...props }: ComponentProps<typeof CommandPrimitive.Empty>) {
	return (
		<CommandPrimitive.Empty
			data-slot='command-empty'
			className={cn('py-6 text-center text-sm text-muted-foreground', className)}
			{...props}
		/>
	);
}

function CommandGroup({ className, ...props }: ComponentProps<typeof CommandPrimitive.Group>) {
	return (
		<CommandPrimitive.Group
			data-slot='command-group'
			className={cn(
				'overflow-hidden p-1 text-foreground **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-muted-foreground',
				className,
			)}
			{...props}
		/>
	);
}

function CommandSeparator({ className, ...props }: ComponentProps<typeof CommandPrimitive.Separator>) {
	return (
		<CommandPrimitive.Separator
			data-slot='command-separator'
			className={cn('-mx-1 h-px bg-border', className)}
			{...props}
		/>
	);
}

function CommandItem({ className, ...props }: ComponentProps<typeof CommandPrimitive.Item>) {
	return (
		<CommandPrimitive.Item
			data-slot='command-item'
			className={cn(
				"group/command-item relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none in-data-[slot=dialog-content]:rounded-lg data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-muted data-[selected=true]:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		/>
	);
}

function CommandShortcut({ className, ...props }: ComponentProps<'span'>) {
	return (
		<span
			data-slot='command-shortcut'
			className={cn(
				'ml-auto text-xs tracking-widest text-muted-foreground group-data-[selected=true]/command-item:text-foreground',
				className,
			)}
			{...props}
		/>
	);
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
