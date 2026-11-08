import { Loader2 } from 'lucide-react';
import { AlertDialog as AlertDialogPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Always controlled: the caller owns `open`, so a pending action can keep the dialog up. */
function AlertDialog({ open = false, ...props }: ComponentProps<typeof AlertDialogPrimitive.Root>) {
	return <AlertDialogPrimitive.Root data-slot='alert-dialog' open={open} {...props} />;
}

function AlertDialogTrigger(props: ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
	return <AlertDialogPrimitive.Trigger data-slot='alert-dialog-trigger' {...props} />;
}

function AlertDialogOverlay({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
	return (
		<AlertDialogPrimitive.Overlay
			data-slot='alert-dialog-overlay'
			className={cn(
				'fixed inset-0 z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
				className,
			)}
			{...props}
		/>
	);
}

/**
 * An alert dialog ignores outside clicks by design. `closeOnOutsideClick` opts a low-stakes one out of that: a click
 * on the overlay calls `onCloseOnOutsideClick`.
 */
function AlertDialogContent({
	className,
	size = 'default',
	closeOnOutsideClick = false,
	onCloseOnOutsideClick,
	...props
}: ComponentProps<typeof AlertDialogPrimitive.Content> & {
	size?: 'default' | 'sm';
	closeOnOutsideClick?: boolean;
	onCloseOnOutsideClick?: () => void;
}) {
	return (
		<AlertDialogPrimitive.Portal>
			<AlertDialogOverlay onClick={closeOnOutsideClick ? onCloseOnOutsideClick : undefined} />
			<AlertDialogPrimitive.Content
				data-slot='alert-dialog-content'
				data-size={size}
				className={cn(
					'group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-popover-foreground ring-1 ring-foreground/10 shadow-lg duration-100 outline-none data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-md data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
					className,
				)}
				{...props}
			/>
		</AlertDialogPrimitive.Portal>
	);
}

function AlertDialogHeader({ className, ...props }: ComponentProps<'div'>) {
	return (
		<div
			data-slot='alert-dialog-header'
			className={cn(
				'grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left',
				className,
			)}
			{...props}
		/>
	);
}

function AlertDialogFooter({ className, ...props }: ComponentProps<'div'>) {
	return (
		<div
			data-slot='alert-dialog-footer'
			className={cn(
				'-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end',
				className,
			)}
			{...props}
		/>
	);
}

function AlertDialogTitle({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Title>) {
	return (
		<AlertDialogPrimitive.Title
			data-slot='alert-dialog-title'
			className={cn('font-heading text-base font-semibold', className)}
			{...props}
		/>
	);
}

function AlertDialogDescription({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Description>) {
	return (
		<AlertDialogPrimitive.Description
			data-slot='alert-dialog-description'
			className={cn(
				'text-sm text-balance text-muted-foreground md:text-pretty *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground',
				className,
			)}
			{...props}
		/>
	);
}

/** Closes after the handler runs, unless the handler prevented the default. */
function AlertDialogAction({
	variant = 'default',
	size = 'default',
	isLoading = false,
	disabled,
	children,
	className,
	...props
}: ComponentProps<typeof Button>) {
	return (
		<AlertDialogPrimitive.Action asChild>
			<Button
				variant={variant}
				size={size}
				data-slot='alert-dialog-action'
				disabled={isLoading || disabled}
				className={className}
				{...props}
			>
				{isLoading && <Loader2 className='animate-spin' />}
				{children}
			</Button>
		</AlertDialogPrimitive.Action>
	);
}

function AlertDialogCancel({
	variant = 'outline',
	size = 'default',
	children = 'Cancel',
	...props
}: ComponentProps<typeof Button>) {
	return (
		<AlertDialogPrimitive.Cancel asChild>
			<Button variant={variant} size={size} data-slot='alert-dialog-cancel' {...props}>
				{children}
			</Button>
		</AlertDialogPrimitive.Cancel>
	);
}

export {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogOverlay,
	AlertDialogTitle,
	AlertDialogTrigger,
};
