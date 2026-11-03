import styles from './settings-card.module.css';
import { cn } from '@/lib/utils';

export function SettingsPageWrapper({
	children,
	wide,
	full,
}: {
	children: React.ReactNode;
	wide?: boolean;
	/** No width limit: for pages that lay themselves out. */
	full?: boolean;
}) {
	return (
		<div className={styles.settingsPageWrapperDiv}>
			<div
				className={cn(
					styles.settingsPageWrapperDiv2,
					full
						? styles.settingsPageWrapperFull
						: wide
							? styles.settingsPageWrapperDiv3
							: styles.settingsPageWrapperDiv4,
				)}
			>
				{children}
			</div>
		</div>
	);
}

interface SettingsCardProps {
	icon?: React.ReactNode;
	title?: string;
	titleSize?: 'md' | 'lg';
	description?: React.ReactNode;
	action?: React.ReactNode;
	children: React.ReactNode;
	rootClassName?: string;
	className?: string;
	divide?: boolean;
	flush?: boolean;
	unstyled?: boolean;
}

export function SettingsCard({
	icon,
	title,
	titleSize = 'md',
	description,
	action,
	children,
	rootClassName,
	className,
	divide = false,
	flush = false,
	unstyled = false,
}: SettingsCardProps) {
	return (
		<div
			className={cn(
				styles.settingsCardDiv,
				titleSize === 'lg' && styles.settingsCardDiv2,
				titleSize === 'md' && styles.settingsCardDiv3,
				rootClassName,
			)}
		>
			{(title || action) && (
				<div className={styles.settingsCardDiv4}>
					<div className={styles.settingsCardDiv5}>
						<div className={styles.settingsCardDiv6}>
							{icon && <div className={styles.settingsCardDiv7}>{icon}</div>}
							<div className={styles.settingsCardDiv8}>
								{title && (
									<div
										className={cn(
											styles.settingsCardDiv9,
											titleSize === 'lg' && styles.settingsCardDiv10,
											titleSize === 'md' && styles.settingsCardDiv11,
										)}
									>
										{title}
									</div>
								)}
							</div>
						</div>
						{description && (
							<p
								className={cn(
									styles.settingsCardP,
									titleSize === 'lg' && styles.settingsCardP2,
									titleSize === 'md' && styles.settingsCardP3,
								)}
							>
								{description}
							</p>
						)}
					</div>
					{action && <div className={styles.settingsCardDiv12}>{action}</div>}
				</div>
			)}

			<div
				className={cn(
					styles.settingsCardDiv13,
					!unstyled && styles.settingsCardDiv14,
					flush && styles.settingsCardDiv15,
					!unstyled && flush && styles.settingsCardDiv16,
					divide && styles.settingsCardDiv17,
					className,
				)}
			>
				{children}
			</div>
		</div>
	);
}
