import { Switch as SwitchPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

const trackClassName =
	'peer group/switch relative inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50';
const thumbClassName =
	'pointer-events-none block size-4 rounded-full bg-background ring-0 shadow-xs transition-transform data-checked:translate-x-[calc(100%-2px)] data-unchecked:translate-x-0 dark:data-checked:bg-primary-foreground dark:data-unchecked:bg-foreground';

interface SwitchProps {
	checked: boolean;
	onCheckedChange?: (checked: boolean) => void;
	disabled?: boolean;
	id?: string;
	className?: string;
	'aria-label'?: string;
	'aria-labelledby'?: string;
}

export function Switch({ className, ...props }: SwitchProps) {
	return (
		<SwitchPrimitive.Root data-slot='switch' className={cn(trackClassName, className)} {...props}>
			<SwitchPrimitive.Thumb data-slot='switch-thumb' className={thumbClassName} />
		</SwitchPrimitive.Root>
	);
}

/** The switch's look for a row that is itself the control (a menu item, a toggle row). */
export function SwitchIndicator({ checked, className }: { checked: boolean; className?: string }) {
	const state = checked ? 'checked' : 'unchecked';
	return (
		<span aria-hidden='true' data-state={state} className={cn(trackClassName, className)}>
			<span data-state={state} className={thumbClassName} />
		</span>
	);
}
