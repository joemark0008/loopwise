import styles from './avatar.module.css';
import type { VariantProps } from '@/lib/utils';
import { classVariants, cn } from '@/lib/utils';
import { hashValue } from '@/lib/hash';

const avatarColors = [
	styles.avatarColors,
	styles.avatarColors2,
	styles.avatarColors3,
	styles.avatarColors4,
	styles.avatarColors5,
	styles.avatarColors6,
	styles.avatarColors7,
	styles.avatarColors8,
	styles.avatarColors9,
	styles.avatarColors10,
	styles.avatarColors11,
	styles.avatarColors12,
	styles.avatarColors13,
	styles.avatarColors14,
	styles.avatarColors15,
	styles.avatarColors16,
	styles.avatarColors17,
];

function getInitials(username: string): string {
	const parts = username.trim().split(/\s+/);
	if (parts.length === 1) {
		return parts[0].charAt(0).toUpperCase();
	}
	return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getColorClass(username: string): string {
	const hash = hashValue(username);
	return avatarColors[hash % avatarColors.length];
}

const avatarVariants = classVariants(styles.avatarVariants, {
	variants: {
		size: {
			sm: styles.avatarVariantsSm,
			default: styles.avatarVariantsDefault,
			lg: styles.avatarVariantsLg,
			xl: styles.avatarVariantsXl,
		},
	},
	defaultVariants: {
		size: 'default',
	},
});

type AvatarProps = Omit<React.ComponentProps<'div'>, 'className'> &
	VariantProps<typeof avatarVariants> & { username: string; className?: string };

export function Avatar({ username, size, className, ...props }: AvatarProps) {
	const initials = getInitials(username);
	const colorClass = getColorClass(username);

	return (
		<div className={cn(avatarVariants({ size }), colorClass, className)} title={username} {...props}>
			{initials}
		</div>
	);
}
