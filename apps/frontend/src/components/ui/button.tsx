import * as React from 'react';
import { ArrowUpIcon, Loader2, Mic, SquareIcon } from 'lucide-react';
import styles from './button.module.css';
import type { VariantProps } from '@/lib/utils';
import { Slot } from '@/components/ui/slot';

import { LastUsedPill } from '@/components/ui/last-used-pill';
import { classVariants, cn } from '@/lib/utils';

const buttonVariants = classVariants(styles.buttonVariants, {
	variants: {
		variant: {
			default: styles.buttonVariantsDefault,
			'primary-gradient': styles.buttonVariantsPrimaryGradient,
			'primary-gradient-border': styles.buttonVariantsPrimaryGradientBorder,
			destructive: styles.buttonVariantsDestructive,
			'destructive-soft': styles.buttonVariantsDestructiveSoft,
			outline: styles.buttonVariantsOutline,
			secondary: styles.buttonVariantsSecondary,
			'ghost-muted': styles.buttonVariantsGhostMuted,
			'ghost-no-hover': styles.buttonVariantsGhostNoHover,
			ghost: styles.buttonVariantsGhost,
			link: styles.buttonVariantsLink,
		},
		size: {
			default: styles.buttonVariantsDefault2,
			sm: styles.buttonVariantsSm,
			lg: styles.buttonVariantsLg,
			icon: styles.buttonVariantsIcon,
			'icon-xs': styles.buttonVariantsIconXs,
			'icon-sm': styles.buttonVariantsIconSm,
			'icon-md': styles.buttonVariantsIcon,
			'icon-lg': styles.buttonVariantsIconLg,
		},
	},
	defaultVariants: {
		variant: 'default',
		size: 'default',
	},
});

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
	const Comp = asChild ? Slot : 'button';

	return (
		<Comp
			data-slot='button'
			data-variant={variant}
			data-size={size}
			disabled={isLoading || props.disabled}
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		>
			{isLoading ? (
				<>
					<Loader2 className={styles.buttonLoader2} />
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
		<button type='submit' className={styles.buttonConnectionButton}>
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
			variant='primary-gradient-border'
			className={styles.chatSendButtonButton}
		>
			{showStop ? (
				<SquareIcon fill='currentColor' stroke='currentColor' className={styles.chatSendButtonSquareIcon} />
			) : (
				<ArrowUpIcon className={styles.chatSendButtonArrowUpIcon} />
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
			className={`${styles.micButtonButton} ${isRecording ? styles.state100 : styles.state101} `}
		>
			{isTranscribing ? <Loader2 className={styles.micButtonLoader2} /> : <Mic className={styles.micButtonMic} />}
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
			className={cn(styles.authSocialButtonButton, className)}
			onClick={onClick}
		>
			<Icon className={styles.authSocialButtonIcon} />
			{label}
			{lastUsed && <LastUsedPill className={styles.authSocialButtonLastUsedPill} />}
		</Button>
	);
}

export { Button, ButtonConnection, ChatSendButton as ChatButton, MicButton, AuthSocialButton, buttonVariants };
