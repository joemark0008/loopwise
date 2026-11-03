import * as React from 'react';
import styles from './badge.module.css';
import type { VariantProps } from '@/lib/utils';
import { Slot } from '@/components/ui/slot';

import { classVariants, cn } from '@/lib/utils';

const badgeVariants = classVariants(styles.badgeVariants, {
	variants: {
		variant: {
			default: styles.badgeVariantsDefault,
			secondary: styles.badgeVariantsSecondary,
			destructive: styles.badgeVariantsDestructive,
			outline: styles.badgeVariantsOutline,
			ghost: styles.badgeVariantsGhost,
			link: styles.badgeVariantsLink,
			admin: styles.badgeVariantsAdmin,
			user: styles.badgeVariantsUser,
			viewer: styles.badgeVariantsViewer,
			context_admin: styles.badgeVariantsContextAdmin,
			success: styles.badgeVariantsSuccess,
			error: styles.badgeVariantsError,
		},
	},
	defaultVariants: {
		variant: 'default',
	},
});

function Badge({
	className,
	variant = 'default',
	asChild = false,
	...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
	const Comp = asChild ? Slot : 'span';

	return (
		<Comp
			data-slot='badge'
			data-variant={variant}
			className={cn(badgeVariants({ variant }), className)}
			{...props}
		/>
	);
}

export { Badge, badgeVariants };
