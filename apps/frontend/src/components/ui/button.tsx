import { cva } from 'class-variance-authority';
import { ArrowUpIcon, Loader2, Mic, SquareIcon } from 'lucide-react';
import { Slot } from 'radix-ui';
import type { VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { LastUsedPill } from '@/components/ui/last-used-pill';
import { cn } from '@/lib/utils';

/**
 * The kit's button. Heights follow `--app-control-height` (36px, 44px on touch). `primary-gradient*` and
 * `ghost-*` are Loopwise names kept for their callers; with the kit's flat primary they read as `default`/`ghost`.
 */
const buttonVariants = cva(
	"group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground hover:bg-primary/85',
				'primary-gradient': 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/85',
				'primary-gradient-border': 'bg-primary text-primary-foreground hover:bg-primary/85',
				destructive:
					'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40',
				'destructive-soft':
					'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30',
				outline:
					'border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
				secondary:
					'bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
				ghost: 'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50',
				'ghost-muted': 'text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted/50',
				'ghost-no-hover': 'hover:text-foreground',
				link: 'text-primary underline-offset-4 hover:underline',
			},
			size: {
				default:
					'h-(--app-control-height) px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5',
				xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
				sm: "h-(--app-control-height-sm) gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
				lg: 'h-10 gap-1.5 px-4',
				icon: 'size-(--app-control-height)',
				'icon-xs': "size-6 rounded-[min(var(--radius-md),10px)] [&_svg:not([class*='size-'])]:size-3",
				'icon-sm': 'size-7 rounded-[min(var(--radius-md),12px)]',
				'icon-md': 'size-8',
				'icon-lg': 'size-10',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
);

function Button({
	className,
	variant = 'default',
	size = 'default',
	asChild = false,
	isLoading = false,
	children,
	...props
}: React.ComponentProps<'button'> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
		isLoading?: boolean;
	}): React.ReactNode {
	const Comp = asChild ? Slot.Root : 'button';

	return (
		<Comp
			data-slot='button'
			data-variant={variant}
			data-size={size}
			disabled={isLoading || props.disabled}
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		>
			{isLoading && !asChild ? (
				<>
					<Loader2 className='animate-spin' />
					{children}
				</>
			) : (
				children
			)}
		</Comp>
	);
}

function ButtonConnection({ children }: React.ComponentProps<'button'>) {
	return (
		<button
			type='submit'
			className='flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-4 py-2 shadow-xs transition-all duration-200 hover:bg-muted hover:text-foreground hover:shadow-sm'
		>
			{children}
		</button>
	);
}

function ChatSendButton({ showStop, disabled, ...props }: React.ComponentProps<'button'> & { showStop: boolean }) {
	disabled = !showStop && disabled;

	return (
		<Button
			aria-label={showStop ? 'Stop' : 'Send'}
			{...props}
			disabled={disabled}
			size='icon-sm'
			variant='default'
			className='ml-auto size-7 rounded-full'
		>
			{showStop ? (
				<SquareIcon fill='currentColor' stroke='currentColor' className='size-3' />
			) : (
				<ArrowUpIcon className='size-4' />
			)}
		</Button>
	);
}

function MicButton({
	state,
	onClick,
	disabled,
}: {
	state: 'idle' | 'recording' | 'transcribing';
	onClick: () => void;
	disabled?: boolean;
}) {
	const isRecording = state === 'recording';
	const isTranscribing = state === 'transcribing';

	return (
		<button
			type='button'
			onClick={onClick}
			disabled={disabled || isTranscribing}
			aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
			className={cn(
				'inline-flex size-7 cursor-pointer items-center justify-center rounded-full transition-all disabled:pointer-events-none disabled:opacity-50',
				isRecording ? 'animate-pulse bg-primary/20 text-primary' : 'text-foreground hover:bg-muted',
			)}
		>
			{isTranscribing ? <Loader2 className='size-4 animate-spin' /> : <Mic className='size-4' />}
		</button>
	);
}

function AuthSocialButton({
	icon: Icon,
	label,
	onClick,
	lastUsed = false,
	className,
}: {
	icon: React.FC<React.SVGProps<SVGSVGElement>>;
	label: string;
	onClick: () => void;
	lastUsed?: boolean;
	className?: string;
}) {
	return (
		<Button
			type='button'
			variant='outline'
			aria-label={lastUsed ? `${label} (last used)` : label}
			className={cn('relative h-11 w-full gap-2.5', className)}
			onClick={onClick}
		>
			<Icon className='size-4' />
			{label}
			{lastUsed && <LastUsedPill className='absolute -top-2 right-3' />}
		</Button>
	);
}

export { AuthSocialButton, Button, ButtonConnection, ChatSendButton as ChatButton, MicButton, buttonVariants };
