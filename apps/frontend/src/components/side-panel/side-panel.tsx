import { memo, useEffect } from 'react';

import styles from './side-panel.module.css';
import { ResizableHandle } from '@/components/ui/resizable';
import { useSidePanel } from '@/contexts/side-panel';
import { useSidePanelResize } from '@/hooks/use-side-panel-resize';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { cn } from '@/lib/utils';

type SidePanelProps = {
	containerRef: React.RefObject<HTMLDivElement | null>;
	sidePanelRef: React.RefObject<HTMLDivElement | null>;
	resizeHandleRef: React.RefObject<HTMLDivElement | null>;
	children: React.ReactNode;
	isAnimating: boolean;
	chatPanelMinWidth?: number;
	variant?: SidePanelVariant;
	className?: string;
};

type SidePanelVariant = 'floating' | 'docked';

const PANEL_VARIANT_CLASS_NAMES: Record<SidePanelVariant, string> = {
	floating: styles.pANELVARIANTCLASSNAMESFloating,
	docked: styles.pANELVARIANTCLASSNAMESDocked,
};

export const SidePanel = memo(function SidePanel({
	containerRef,
	sidePanelRef,
	resizeHandleRef,
	children,
	isAnimating,
	chatPanelMinWidth,
	variant = 'floating',
	className,
}: SidePanelProps) {
	const isMobile = useIsMobile();
	const { close } = useSidePanel();
	useSidePanelResize(sidePanelRef, containerRef, resizeHandleRef, !isAnimating && !isMobile, chatPanelMinWidth);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape' || event.defaultPrevented || isEditableTarget(event.target)) {
				return;
			}
			close();
		};
		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [close]);

	if (isMobile) {
		return (
			<div ref={sidePanelRef} className={styles.sidePanelDiv}>
				<div className={styles.sidePanelDiv2}>{children}</div>
			</div>
		);
	}

	return (
		<div ref={sidePanelRef} className={cn(styles.sidePanelDiv3, className)}>
			<div className={styles.sidePanelDiv4}>
				<div className={styles.sidePanelDiv5} ref={resizeHandleRef}>
					<ResizableHandle aria-orientation='vertical' className={styles.sidePanelResizableHandle} />
				</div>

				<div className={cn(styles.sidePanelDiv6, PANEL_VARIANT_CLASS_NAMES[variant])}>
					<div className={styles.sidePanelDiv7}>{children}</div>
				</div>
			</div>
		</div>
	);
});

function isEditableTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) {
		return false;
	}
	return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}
