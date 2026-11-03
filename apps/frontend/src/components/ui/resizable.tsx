import * as ResizablePrimitive from 'react-resizable-panels';

import styles from './resizable.module.css';
import { cn } from '@/lib/utils';

function ResizablePanelGroup({ className, ...props }: ResizablePrimitive.GroupProps) {
	return (
		<ResizablePrimitive.Group
			data-slot='resizable-panel-group'
			className={cn(styles.resizablePanelGroupResizablePrimitiveGroup, className)}
			{...props}
		/>
	);
}

function ResizablePanel({ ...props }: ResizablePrimitive.PanelProps) {
	return <ResizablePrimitive.Panel data-slot='resizable-panel' {...props} />;
}

function ResizableSeparator({
	withHandle,
	className,
	children,
	...props
}: ResizablePrimitive.SeparatorProps & {
	withHandle?: boolean;
}) {
	return (
		<ResizablePrimitive.Separator
			data-slot='resizable-handle'
			className={cn(styles.resizableSeparatorResizablePrimitiveSeparator, className)}
			{...props}
		>
			{children}
			{withHandle && <ResizableHandle />}
		</ResizablePrimitive.Separator>
	);
}

function ResizableHandle({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn(styles.resizableHandleDiv, className)} {...props} />;
}

export { ResizableSeparator, ResizableHandle, ResizablePanel, ResizablePanelGroup };
