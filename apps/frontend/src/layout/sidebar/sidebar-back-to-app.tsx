import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';

import styles from './sidebar-back-to-app.module.css';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useBackToApp } from '@/hooks/use-last-app-location';
import { cn, hideIf } from '@/lib/utils';

const BACK_TO_APP_LABEL = 'Back to app';

export function SidebarBackToApp({ isCollapsed }: { isCollapsed: boolean }) {
	const { href, goBack } = useBackToApp();
	const [isTooltipOpen, setIsTooltipOpen] = useState(false);

	const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
		if (isModifiedClick(event)) {
			return;
		}
		event.preventDefault();
		goBack();
	};

	return (
		<Tooltip open={isCollapsed && isTooltipOpen} onOpenChange={setIsTooltipOpen}>
			<TooltipTrigger asChild>
				<Button
					asChild
					variant='ghost'
					className={cn(
						`${styles.sidebarBackToAppButton} group`,
						isCollapsed ? styles.sidebarBackToAppButton2 : '',
					)}
				>
					<a href={href} onClick={handleClick} aria-label={BACK_TO_APP_LABEL}>
						<ArrowLeft className={styles.sidebarBackToAppArrowLeft} />
						<span className={cn(styles.sidebarBackToAppSpan, hideIf(isCollapsed))}>
							{BACK_TO_APP_LABEL}
						</span>
					</a>
				</Button>
			</TooltipTrigger>
			<TooltipContent side='right'>{BACK_TO_APP_LABEL}</TooltipContent>
		</Tooltip>
	);
}

function isModifiedClick(event: React.MouseEvent) {
	return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}
