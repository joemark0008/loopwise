import { AVATAR_COLORS, AVATAR_TEXT_COLOR } from './avatar-colors';
import styles from './avatar.module.css';
import type { VariantProps } from '@/lib/utils';
import { classVariants, cn } from '@/lib/utils';
import { hashValue } from '@/lib/hash';

function getInitials(username: string): string {
	const parts = username.trim().split(/\s+/);
	if (parts.length === 1) {
		return parts[0].charAt(0).toUpperCase();
	}
	return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getColor(username: string): string {
	return AVATAR_COLORS[hashValue(username) % AVATAR_COLORS.length];
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

export function Avatar({ username, size, className, style, ...props }: AvatarProps) {
	const initials = getInitials(username);

	return (
		<div
			className={cn(avatarVariants({ size }), className)}
			style={{ backgroundColor: getColor(username), color: AVATAR_TEXT_COLOR, ...style }}
			title={username}
			{...props}
		>
			{initials}
		</div>
	);
}
