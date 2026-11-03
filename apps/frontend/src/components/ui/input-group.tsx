import * as React from 'react';

import styles from './input-group.module.css';
import type { VariantProps } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { classVariants, cn } from '@/lib/utils';

function InputGroup({ className, ...props }: React.ComponentProps<'label'>) {
	return (
		<label
			data-slot='input-group'
			role='group'
			className={cn(
				`${styles.inputGroupLabel} group/input-group`,
				styles.inputGroupLabel2,

				// Variants based on alignment.
				styles.inputGroupLabel3,
				styles.inputGroupLabel4,
				styles.inputGroupLabel5,
				styles.inputGroupLabel6,

				// Focus state.
				styles.inputGroupLabel7,

				// Error state.
				styles.inputGroupLabel8,

				className,
			)}
			{...props}
		/>
	);
}

const inputGroupAddonVariants = classVariants(styles.inputGroupAddonVariants, {
	variants: {
		align: {
			'inline-start': styles.inputGroupAddonVariantsInlineStart,
			'inline-end': styles.inputGroupAddonVariantsInlineEnd,
			'block-start': styles.inputGroupAddonVariantsBlockStart,
			'block-end': styles.inputGroupAddonVariantsBlockEnd,
		},
	},
	defaultVariants: {
		align: 'inline-start',
	},
});

function InputGroupAddon({
	className,
	align = 'inline-start',
	...props
}: React.ComponentProps<'div'> & VariantProps<typeof inputGroupAddonVariants>) {
	return (
		<div
			role='group'
			data-slot='input-group-addon'
			data-align={align}
			className={cn(inputGroupAddonVariants({ align }), className)}
			onClick={(e) => {
				if ((e.target as HTMLElement).closest('button')) {
					return;
				}
				e.currentTarget.parentElement?.querySelector('input')?.focus();
			}}
			{...props}
		/>
	);
}

const inputGroupButtonVariants = classVariants(styles.inputGroupButtonVariants, {
	variants: {
		size: {
			xs: styles.inputGroupButtonVariantsXs,
			sm: styles.inputGroupButtonVariantsSm,
			'icon-xs': styles.inputGroupButtonVariantsIconXs,
			'icon-sm': styles.inputGroupButtonVariantsIconSm,
		},
	},
	defaultVariants: {
		size: 'xs',
	},
});

function InputGroupButton({
	className,
	type = 'button',
	variant = 'ghost',
	size = 'xs',
	...props
}: Omit<React.ComponentProps<typeof Button>, 'size'> & VariantProps<typeof inputGroupButtonVariants>) {
	return (
		<Button
			type={type}
			data-size={size}
			variant={variant}
			className={cn(inputGroupButtonVariants({ size }), className)}
			{...props}
		/>
	);
}

function InputGroupText({ className, ...props }: React.ComponentProps<'span'>) {
	return <span className={cn(styles.inputGroupTextSpan, className)} {...props} />;
}

function InputGroupInput({ className, ...props }: React.ComponentProps<'input'>) {
	return <Input data-slot='input-group-control' className={cn(styles.inputGroupInputInput, className)} {...props} />;
}

function InputGroupTextarea({ className, ...props }: React.ComponentProps<'textarea'>) {
	return (
		<Textarea
			data-slot='input-group-control'
			className={cn(styles.inputGroupTextareaTextarea, className)}
			{...props}
		/>
	);
}

export { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText, InputGroupTextarea };
