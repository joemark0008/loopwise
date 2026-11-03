import { ChevronRight } from 'lucide-react';
import styles from './expandable.module.css';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

/** `grouped` reads like `inline` but keeps a header row so trailing actions can sit beside the title. */
type ExpandableVariant = 'inline' | 'bordered' | 'plain' | 'grouped';

interface ExpandableProps {
	title: ReactNode;
	badge?: ReactNode;
	children: ReactNode;
	expanded: boolean;
	onExpandedChange: (expanded: boolean) => void;
	disabled?: boolean;
	isLoading?: boolean;
	leadingIcon?: ReactNode;
	titleAction?: ReactNode;
	trailingContent?: ReactNode;
	variant?: ExpandableVariant;
	className?: string;
	triggerClassName?: string;
}

export const Expandable = ({
	title,
	badge,
	children,
	expanded,
	onExpandedChange,
	disabled = false,
	isLoading = false,
	leadingIcon,
	titleAction,
	trailingContent,
	variant = 'inline',
	className,
	triggerClassName,
}: ExpandableProps) => {
	const canExpand = !disabled;
	const isBordered = variant === 'bordered';
	const isPlain = variant === 'plain';
	const isInline = variant === styles.isInline;
	const isGrouped = variant === 'grouped';
	const hasHeaderRow = !isInline;
	const hasHeaderEmphasis = isBordered || isPlain;

	const handleValueChange = () => {
		if (canExpand) {
			onExpandedChange(!expanded);
		}
	};

	const icon = leadingIcon ?? (
		<ChevronRight
			size={12}
			className={cn(styles.iconChevronRight, expanded && styles.iconChevronRight2)}
			strokeWidth={3.25}
		/>
	);

	return (
		<Accordion
			type='single'
			collapsible
			value={expanded ? 'expandable-content' : ''}
			onValueChange={handleValueChange}
			disabled={!canExpand}
			className={cn(isBordered && `${styles.expandableAccordion} bg-backgroundSecondary/30`, className)}
		>
			<AccordionItem value='expandable-content' className={styles.expandableAccordionItem} style={{ padding: 0 }}>
				{hasHeaderRow ? (
					<div
						className={cn(
							styles.expandableDiv,
							isBordered && styles.expandableDiv2,
							isPlain && styles.expandableDiv3,
							canExpand && styles.expandableDiv4,
						)}
						onClick={() => canExpand && onExpandedChange(!expanded)}
					>
						<div
							className={cn(
								styles.expandableDiv5,
								titleAction ? styles.expandableDiv6 : styles.expandableDiv7,
							)}
						>
							<AccordionTrigger
								headerClassName={styles.expandableAccordionTrigger}
								className={cn(
									styles.expandableAccordionTrigger2,
									styles.expandableAccordionTrigger3,
									canExpand ? styles.expandableDiv4 : '',
									triggerClassName,
								)}
							>
								<div className={styles.expandableDiv8}>{icon}</div>
								<span
									className={cn(
										styles.expandableSpan,
										hasHeaderEmphasis ? styles.expandableSpan2 : styles.expandableSpan3,
										isLoading && styles.expandableSpan4,
									)}
								>
									{title}
								</span>
								{badge && !expanded && <span className={styles.expandableSpan5}>{badge}</span>}
							</AccordionTrigger>
							{titleAction}
						</div>
						{trailingContent}
					</div>
				) : (
					<AccordionTrigger
						className={cn(
							styles.expandableAccordionTrigger4,
							canExpand ? styles.expandableDiv4 : '',
							triggerClassName,
						)}
					>
						<div className={styles.expandableDiv9}>{icon}</div>
						<span className={cn(styles.expandableSpan6, isLoading && styles.expandableSpan4)}>{title}</span>
						{badge && !expanded && <span className={styles.expandableSpan7}>{badge}</span>}
					</AccordionTrigger>
				)}

				<AccordionContent
					className={cn(styles.expandableAccordionContent, isInline && styles.expandableAccordionContent2)}
				>
					{isBordered ? (
						<div className={styles.expandableDiv10}>{children}</div>
					) : isPlain || isGrouped ? (
						<div>{children}</div>
					) : (
						<div className={`${styles.expandableDiv11} bg-backgroundSecondary`}>
							<div className={styles.expandableDiv12} />
							<div>{children}</div>
						</div>
					)}
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
};
