import { Link } from '@tanstack/react-router';
import { SlidersVertical } from 'lucide-react';
import styles from './sidebar-user-menu.module.css';
import { Avatar } from '@/components/ui/avatar';
import { useCurrentUser } from '@/hooks/use-current-user';
import { cn, hideIf } from '@/lib/utils';

interface SidebarUserMenuProps {
	isCollapsed: boolean;
	isInSettings: boolean;
}

export function SidebarUserMenu({ isCollapsed, isInSettings }: SidebarUserMenuProps) {
	const { data: user } = useCurrentUser();
	const username = user?.name;
	const email = user?.email;

	if (isInSettings && isCollapsed) {
		return null;
	}

	return (
		<div className={styles.sidebarUserMenuDiv}>
			<div
				className={cn(
					`${styles.sidebarUserMenuDiv2} group/user`,
					styles.sidebarUserMenuDiv3,
					isCollapsed ? styles.sidebarUserMenuDiv4 : styles.sidebarUserMenuDiv5,
				)}
			>
				{/* On the rail the name is hidden, so only the settings button (named) remains. */}
				{!isCollapsed && (
					<Link
						to='/settings'
						inactiveProps={{ className: styles.sidebarUserMenuClassName }}
						activeProps={{ className: styles.sidebarUserMenuClassName }}
						className={styles.sidebarUserMenuLink}
					>
						<div className={cn(styles.sidebarUserMenuDiv6, hideIf(isCollapsed))}>
							{!isCollapsed && username && (
								<Avatar username={username} className={styles.sidebarUserMenuAvatar} />
							)}
							<span className={cn(styles.sidebarUserMenuSpan, hideIf(isCollapsed))}>
								<span className={styles.sidebarUserMenuSpan2}>{username}</span>
								<span className={styles.sidebarUserMenuSpan3}>{email}</span>
							</span>
						</div>
					</Link>
				)}
				{!isInSettings && (
					<div
						className={cn(
							styles.sidebarUserMenuDiv7,
							isCollapsed ? styles.sidebarUserMenuDiv5 : styles.sidebarUserMenuDiv8,
						)}
					>
						<Link to='/settings' className={styles.sidebarUserMenuLink2} aria-label='Settings'>
							<SlidersVertical className={styles.sidebarUserMenuSlidersVertical} aria-hidden />
						</Link>
					</div>
				)}
			</div>
		</div>
	);
}
