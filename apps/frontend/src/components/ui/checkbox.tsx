import { CheckIcon, MinusIcon } from 'lucide-react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/** `checked` is a boolean here: callers never pass the indeterminate state through `onCheckedChange`. */
function Checkbox({
	className,
	onCheckedChange,
	...props
}: Omit<ComponentProps<typeof CheckboxPrimitive.Root>, 'onCheckedChange'> & {
	onCheckedChange?: (checked: boolean) => void;
}) {
	return (
		<CheckboxPrimitive.Root
			data-slot='checkbox'
			className={cn(
				'peer group/checkbox relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-control-line transition-colors outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground',
				className,
			)}
			onCheckedChange={(checked) => onCheckedChange?.(checked === true)}
			{...props}
		>
			<CheckboxPrimitive.Indicator
				data-slot='checkbox-indicator'
				className='grid place-content-center text-current transition-none [&>svg]:size-3.5'
			>
				{props.checked === 'indeterminate' ? <MinusIcon /> : <CheckIcon />}
			</CheckboxPrimitive.Indicator>
		</CheckboxPrimitive.Root>
	);
}

export { Checkbox };
