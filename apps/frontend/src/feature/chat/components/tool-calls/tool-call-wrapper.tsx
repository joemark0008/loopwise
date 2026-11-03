import { CircleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import styles from './tool-call-wrapper.module.css';
import type { ReactNode } from 'react';
import type { DataExportFormat } from '@/components/export-data-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { Expandable } from '@/components/ui/expandable';
import { useToolCallContext } from '@/contexts/tool-call';
import { useIsInToolGroup } from '@/contexts/tool-group';
import { ToolCallActionsProvider } from '@/contexts/tool-call-actions';
import { useMemoObject } from '@/hooks/useMemoObject';
import { ExportDataMenu } from '@/components/export-data-menu';

interface ExportAction {
	columns: string[];
	data: Record<string, unknown>[];
	loadAllRows?: () => Promise<Record<string, unknown>[]>;
	filename: string;
	onExport?: (format: DataExportFormat) => void;
}

interface BaseAction {
	id: string;
	label: ReactNode;
	title: string;
	isActive?: boolean;
	expandOnClick?: boolean;
}

interface ButtonAction extends BaseAction {
	onClick: () => void;
}

interface ExportActionButton extends BaseAction {
	export: ExportAction;
}

export type ActionButton = ButtonAction | ExportActionButton;

interface ToolCallWrapperProps {
	title: ReactNode;
	badge?: ReactNode;
	children?: ReactNode;
	actions?: ActionButton[];
	defaultExpanded?: boolean;
	overrideError?: boolean;
}

export const ToolCallWrapper = ({
	title,
	badge,
	children,
	actions,
	defaultExpanded = false,
	overrideError = false,
}: ToolCallWrapperProps) => {
	const { toolPart, isSettled } = useToolCallContext();
	const isInToolGroup = useIsInToolGroup();
	const [isExpanded, setIsExpanded] = useState(false);
	const [isHovering, setIsHovering] = useState(false);
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const toolCallActions = useMemoObject({ setMenuOpen: setIsMenuOpen });
	const canExpand = Boolean(children || toolPart.errorText || toolPart.output);
	const hasInitialized = useRef(false);

	const hasActions = !!actions;
	// Inside a tool group, bordered tools render like their inline neighbours while keeping their actions.
	const isBordered = hasActions && !isInToolGroup;
	const variant = isBordered ? 'bordered' : hasActions ? 'grouped' : 'inline';

	useEffect(() => {
		if (hasActions && !hasInitialized.current && canExpand && defaultExpanded) {
			setIsExpanded(true);
			hasInitialized.current = true;
		}
	}, [hasActions, canExpand, defaultExpanded, setIsExpanded]);

	const hasError = !!toolPart.errorText;
	const showChevron = isSettled && (!hasError || isHovering);

	const statusIcon = showChevron ? undefined : hasError ? (
		<span className={styles.statusIconDiv}>
			<CircleAlert aria-hidden />
			Failed
		</span>
	) : (
		<Spinner className={styles.statusIconSpinner} aria-label='Working' />
	);

	const actionsContent =
		(isHovering || isExpanded || isMenuOpen) && actions && actions.length > 0 ? (
			<div className={cn(styles.actionsContentDiv)}>
				{actions.map((action) => {
					if ('export' in action) {
						return (
							<span key={action.id} onClick={(e) => e.stopPropagation()}>
								<ExportDataMenu {...action.export}>
									<Button
										variant='ghost-muted'
										size='icon-xs'
										title={action.title}
										className={styles.actionsContentButton}
									>
										{action.label}
									</Button>
								</ExportDataMenu>
							</span>
						);
					}

					return (
						<Button
							variant='ghost-muted'
							size='icon-xs'
							key={action.id}
							onClick={(e) => {
								e.stopPropagation();
								if (action.expandOnClick && !isExpanded) {
									setIsExpanded(true);
								}
								action.onClick();
							}}
							title={action.title}
							className={cn(
								styles.actionsContentButton,
								action.isActive ? styles.actionsContentButton2 : '',
							)}
						>
							{action.label}
						</Button>
					);
				})}
			</div>
		) : undefined;

	const errorContent = isBordered ? (
		<pre className={styles.errorContentPre}>{toolPart.errorText}</pre>
	) : (
		<pre className={styles.errorContentPre2}>{toolPart.errorText}</pre>
	);

	const contentToShow = toolPart.errorText && !overrideError ? errorContent : children;

	return (
		<ToolCallActionsProvider value={toolCallActions}>
			<div
				onMouseEnter={() => setIsHovering(true)}
				onMouseLeave={() => setIsHovering(false)}
				className={cn(isBordered && styles.toolCallWrapperDiv)}
				data-replay-target-id={toolPart.toolCallId}
				{...(hasError && {
					'data-replay-nav': 'tool-error',
					'data-replay-bordered': isBordered ? 'true' : 'false',
				})}
			>
				<Expandable
					title={title}
					badge={badge}
					expanded={isExpanded}
					onExpandedChange={setIsExpanded}
					disabled={!canExpand}
					isLoading={!isSettled}
					leadingIcon={statusIcon}
					variant={variant}
					trailingContent={actionsContent}
				>
					{contentToShow}
				</Expandable>
			</div>
		</ToolCallActionsProvider>
	);
};
