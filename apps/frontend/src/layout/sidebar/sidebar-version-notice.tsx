import { useQuery } from '@apollo/client/react';
import { CircleArrowUp } from 'lucide-react';

import styles from './sidebar-version-notice.module.css';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn, hideIf } from '@/lib/utils';
import { CheckUpdateDocument } from '@/graphql/generated/graphql';
import { QUARRY_REPOSITORY_URL } from '@/lib/quarry-links';

interface SidebarVersionNoticeProps {
	isCollapsed: boolean;
}

export function SidebarVersionNotice({ isCollapsed }: SidebarVersionNoticeProps) {
	const { data: result } = useQuery(CheckUpdateDocument);
	const data = result?.checkUpdate;

	if (!data?.updateAvailable || !data.latestVersion) {
		return null;
	}

	const label = `v${data.latestVersion} available`;

	if (isCollapsed) {
		return (
			<Tooltip>
				<TooltipTrigger asChild>
					<div className={styles.sidebarVersionNoticeDiv}>
						<CircleArrowUp className={styles.sidebarVersionNoticeCircleArrowUp} />
					</div>
				</TooltipTrigger>
				<TooltipContent side='right'>{label}</TooltipContent>
			</Tooltip>
		);
	}

	return (
		<a
			href={QUARRY_REPOSITORY_URL ? `${QUARRY_REPOSITORY_URL}/releases/tag/v${data.latestVersion}` : undefined}
			target='_blank'
			rel='noopener noreferrer'
			className={styles.sidebarVersionNoticeA}
		>
			<CircleArrowUp className={styles.sidebarVersionNoticeCircleArrowUp2} />
			<span className={cn(styles.sidebarVersionNoticeSpan, hideIf(isCollapsed))}>{label}</span>
		</a>
	);
}
