import { Modal } from '@mantine/core';
import { Loader2 } from 'lucide-react';
import { createContext, useContext } from 'react';
import styles from './overlay.module.css';
import type { ComponentProps, MouseEvent, ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const AlertDialogContext = createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null);

function useAlertDialogContext() {
	const context = useContext(AlertDialogContext);
	if (!context) {
		throw new Error('AlertDialog parts must be used within an AlertDialog');
	}
	return context;
}

function AlertDialog({
	open = false,
	onOpenChange,
	children,
}: {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	children?: ReactNode;
}) {
	return (
		<AlertDialogContext.Provider value={{ open, setOpen: (next) => onOpenChange?.(next) }}>
			{children}
		</AlertDialogContext.Provider>
	);
}

function AlertDialogContent({
	className,
	size = 'default',
	closeOnOutsideClick = false,
	onCloseOnOutsideClick,
	children,
	...props
}: ComponentProps<'div'> & {
	size?: 'default' | 'sm';
	closeOnOutsideClick?: boolean;
	onCloseOnOutsideClick?: () => void;
}) {
	const { open, setOpen } = useAlertDialogContext();
	return (
		<Modal.Root
			opened={open}
			onClose={() => setOpen(false)}
			centered
			size='auto'
			closeOnClickOutside={closeOnOutsideClick}
			classNames={{
				content: cn(styles.dialog, styles.alertDialog, size === 'sm' && styles.alertDialogSmall, className),
			}}
		>
			<Modal.Overlay
				className={styles.overlay}
				onClick={closeOnOutsideClick ? onCloseOnOutsideClick : undefined}
			/>
			<Modal.Content role='alertdialog' data-slot='alert-dialog-content' data-size={size} {...(props as object)}>
				{children}
			</Modal.Content>
		</Modal.Root>
	);
}

function AlertDialogHeader({ className, ...props }: ComponentProps<'div'>) {
	return <div data-slot='alert-dialog-header' className={cn(styles.dialogHeader, className)} {...props} />;
}

function AlertDialogFooter({ className, ...props }: ComponentProps<'div'>) {
	return <div data-slot='alert-dialog-footer' className={cn(styles.dialogFooter, className)} {...props} />;
}

function AlertDialogTitle({ className, ...props }: ComponentProps<'h2'>) {
	return (
		<Modal.Title
			data-slot='alert-dialog-title'
			className={cn(styles.dialogTitle, className)}
			{...(props as object)}
		/>
	);
}

function AlertDialogDescription({ className, ...props }: ComponentProps<'p'>) {
	return <p data-slot='alert-dialog-description' className={cn(styles.dialogDescription, className)} {...props} />;
}

/** Closes after the handler runs, unless the handler prevented the default. */
function useCloseAfter(onClick: ComponentProps<'button'>['onClick']) {
	const { setOpen } = useAlertDialogContext();
	return (event: MouseEvent<HTMLButtonElement>) => {
		onClick?.(event);
		if (!event.defaultPrevented) {
			setOpen(false);
		}
	};
}

function AlertDialogAction({
	variant = 'default',
	size = 'default',
	children,
	isLoading = false,
	onClick,
	...props
}: ComponentProps<typeof Button>) {
	const handleClick = useCloseAfter(onClick);
	return (
		<Button variant={variant} size={size} data-slot='alert-dialog-action' onClick={handleClick} {...props}>
			{isLoading && <Loader2 data-spin />}
			{children}
		</Button>
	);
}

function AlertDialogCancel({
	variant = 'outline',
	size = 'default',
	onClick,
	children = 'Cancel',
	...props
}: ComponentProps<typeof Button>) {
	const handleClick = useCloseAfter(onClick);
	return (
		<Button variant={variant} size={size} data-slot='alert-dialog-cancel' onClick={handleClick} {...props}>
			{children}
		</Button>
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
	AlertDialogTitle,
};
