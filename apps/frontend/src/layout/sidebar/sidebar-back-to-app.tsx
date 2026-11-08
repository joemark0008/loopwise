import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useBackToApp } from '@/hooks/use-last-app-location';
import { cn } from '@/lib/utils';

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
					size='sm'
					className={cn(
						'group/back h-8 w-full justify-start gap-2 px-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
						isCollapsed && 'size-8 justify-center p-0',
					)}
				>
					<a href={href} onClick={handleClick} aria-label={BACK_TO_APP_LABEL}>
						<ArrowLeft className='size-4 transition-transform group-hover/back:-translate-x-0.5' />
						<span className={cn('truncate', isCollapsed && 'sr-only')}>{BACK_TO_APP_LABEL}</span>
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
