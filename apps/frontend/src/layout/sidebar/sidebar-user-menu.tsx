import { Link } from '@tanstack/react-router';
import { SlidersVertical } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { useCurrentUser } from '@/hooks/use-current-user';

interface SidebarUserMenuProps {
	isCollapsed: boolean;
	isInSettings: boolean;
}

/** The kit's nav-user row: avatar, name and email, opening the user's settings. */
export function SidebarUserMenu({ isCollapsed, isInSettings }: SidebarUserMenuProps) {
	const { data: user } = useCurrentUser();
	const username = user?.name ?? '';

	if (isInSettings && isCollapsed) {
		return null;
	}

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<SidebarMenuButton
					asChild
					size='lg'
					tooltip='Settings'
					className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
				>
					<Link to='/settings' aria-label={isCollapsed ? 'Settings' : undefined}>
						{username && (
							<Avatar username={username} size='sm' decorative className='shrink-0 rounded-lg' />
						)}
						<span className='grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden'>
							<span className='truncate font-medium text-sidebar-accent-foreground'>{username}</span>
							<span className='truncate text-xs text-sidebar-foreground'>{user?.email}</span>
						</span>
						{!isInSettings && (
							<SlidersVertical className='ml-auto size-4 text-muted-foreground' aria-hidden />
						)}
					</Link>
				</SidebarMenuButton>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
