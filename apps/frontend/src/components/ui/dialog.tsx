import { Modal } from '@mantine/core';
import { XIcon } from 'lucide-react';
import { cloneElement, createContext, isValidElement, useContext, useState } from 'react';
import styles from './overlay.module.css';
import type { ComponentProps, ReactElement, ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface DialogContextValue {
	open: boolean;
	setOpen: (open: boolean) => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext() {
	const context = useContext(DialogContext);
	if (!context) {
		throw new Error('Dialog parts must be used within a Dialog');
	}
	return context;
}

function Dialog({
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
	const isOpen = open ?? internalOpen;
	const setOpen = (next: boolean) => {
		setInternalOpen(next);
		onOpenChange?.(next);
	};
	return <DialogContext.Provider value={{ open: isOpen, setOpen }}>{children}</DialogContext.Provider>;
}

function DialogTrigger({ asChild, onClick, children, ...props }: ComponentProps<'button'> & { asChild?: boolean }) {
	const { setOpen } = useDialogContext();
	const open: ComponentProps<'button'>['onClick'] = (event) => {
		onClick?.(event);
		setOpen(true);
	};
	if (asChild && isValidElement(children)) {
		const child = children as ReactElement<ComponentProps<'button'>>;
		return cloneElement(child, {
			...props,
			onClick: (event) => {
				child.props.onClick?.(event);
				open(event);
			},
		});
	}
	return (
		<button type='button' onClick={open} {...props}>
			{children}
		</button>
	);
}

function DialogClose({ asChild, onClick, children, ...props }: ComponentProps<'button'> & { asChild?: boolean }) {
	const { setOpen } = useDialogContext();
	const close: ComponentProps<'button'>['onClick'] = (event) => {
		onClick?.(event);
		setOpen(false);
	};
	if (asChild && isValidElement(children)) {
		const child = children as ReactElement<ComponentProps<'button'>>;
		return cloneElement(child, {
			...props,
			onClick: (event) => {
				child.props.onClick?.(event);
				close(event);
			},
		});
	}
	return (
		<button type='button' onClick={close} {...props}>
			{children}
		</button>
	);
}

function DialogContent({
	className,
	children,
	showCloseButton = true,
	...props
}: ComponentProps<'div'> & { showCloseButton?: boolean }) {
	const { open, setOpen } = useDialogContext();
	return (
		<Modal.Root
			opened={open}
			onClose={() => setOpen(false)}
			centered
			size='auto'
			classNames={{ content: cn(styles.dialog, className) }}
		>
			<Modal.Overlay className={styles.overlay} />
			<Modal.Content data-slot='dialog-content' {...(props as object)}>
				{children}
				{showCloseButton && (
					<button type='button' className={styles.dialogClose} onClick={() => setOpen(false)}>
						<XIcon />
						<span className='sr-only'>Close</span>
					</button>
				)}
			</Modal.Content>
		</Modal.Root>
	);
}

function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
	return <div data-slot='dialog-header' className={cn(styles.dialogHeader, className)} {...props} />;
}

function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
	return <div data-slot='dialog-footer' className={cn(styles.dialogFooter, className)} {...props} />;
}

function DialogTitle({ className, ...props }: ComponentProps<'h2'>) {
	return (
		<Modal.Title data-slot='dialog-title' className={cn(styles.dialogTitle, className)} {...(props as object)} />
	);
}

function DialogDescription({ className, ...props }: ComponentProps<'p'>) {
	return <p data-slot='dialog-description' className={cn(styles.dialogDescription, className)} {...props} />;
}

export {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
};
