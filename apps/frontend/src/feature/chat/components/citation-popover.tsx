import { memo, useCallback, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import styles from './citation-popover.module.css';
import type { CitationPayload, ColumnLineageNode } from '@loopwise/shared';
import { cn } from '@/lib/utils';
import { formatSQL } from '@/lib/sql-formatter';
import { useSidePanel } from '@/contexts/side-panel';
import { SidePanelHeader } from '@/components/side-panel/side-panel-header';
import { chatApi } from '@/lib/chat-api';

const HOVER_DELAY_MS = 500;
const POPOVER_MAX_HEIGHT = 400;
const VIEWPORT_PADDING = 8;

function computeTopOffset(triggerEl: HTMLElement): number {
	const rect = triggerEl.getBoundingClientRect();
	const overflow = rect.top + POPOVER_MAX_HEIGHT - window.innerHeight + VIEWPORT_PADDING;
	return overflow > 0 ? -overflow : 0;
}

export const CitationPopover = memo(
	({ value, queryId, column }: { value: string; queryId: string; column: string }) => {
		const [isOpen, setIsOpen] = useState(false);
		const hasOpened = useRef(false);
		const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
		const triggerRef = useRef<HTMLSpanElement>(null);
		const { open: openSidePanel } = useSidePanel();

		if (isOpen) {
			hasOpened.current = true;
		}

		const { data } = useQuery({
			...chatApi.citation.get.queryOptions({ queryId, column }),
			enabled: hasOpened.current,
		});

		const topOffset = isOpen && triggerRef.current ? computeTopOffset(triggerRef.current) : 0;

		const handleMouseEnter = useCallback(() => {
			timerRef.current = setTimeout(() => setIsOpen(true), HOVER_DELAY_MS);
		}, []);

		const handleMouseLeave = useCallback(() => {
			if (timerRef.current) {
				clearTimeout(timerRef.current);
				timerRef.current = null;
			}
			setIsOpen(false);
		}, []);

		return (
			<span
				ref={triggerRef}
				className={styles.citationPopoverSpan}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
			>
				<span className={styles.citationPopoverSpan2}>{value}</span>
				{isOpen && data && (
					<PopoverContent
						topOffset={topOffset}
						data={data}
						onExpand={() => openSidePanel(<CitationSidePanel data={data} />)}
					/>
				)}
			</span>
		);
	},
);

const PopoverContent = memo(
	({ data, topOffset, onExpand }: { data: CitationPayload; topOffset: number; onExpand: () => void }) => {
		return (
			<div className={styles.popoverContentDiv} style={{ top: topOffset }}>
				<div className={cn(styles.popoverContentDiv2, styles.popoverContentDiv3, styles.popoverContentDiv4)}>
					<div className={styles.popoverContentDiv5}>
						<div className={styles.popoverContentDiv6}>
							<span className={styles.popoverContentSpan}>SQL Query</span>
							<button type='button' onClick={onExpand} className={styles.popoverContentButton}>
								<ArrowUpRight className={styles.popoverContentArrowUpRight} />
							</button>
						</div>
						<details className={styles.popoverContentDetails}>
							<summary className={styles.popoverContentSummary}>Show query</summary>
							<pre className={styles.popoverContentPre}>{data.sql_query}</pre>
						</details>
						<CitationSection title='Database Origin'>
							<p className={styles.popoverContentP}>{data.database_id}</p>
						</CitationSection>
						{data.tables.length > 0 && (
							<CitationSection title='Main Tables'>
								<ul className={styles.popoverContentUl}>
									{data.tables.map((table) => (
										<li key={table.name}>{table.name}</li>
									))}
								</ul>
							</CitationSection>
						)}

						<CitationSection title='Column Lineage'>
							<LineageTree node={data.column_lineage} depth={0} />
						</CitationSection>
					</div>
				</div>
			</div>
		);
	},
);

function CitationSidePanel({ data }: { data: CitationPayload }) {
	return (
		<div className={styles.citationSidePanelDiv}>
			<SidePanelHeader title='Citation' label='Column lineage' />
			<div className={styles.citationSidePanelDiv2}>
				<CitationSection title='SQL Query'>
					<pre className={styles.citationSidePanelPre}>{formatSQL(data.sql_query)}</pre>
				</CitationSection>

				<div>
					<p className={styles.popoverContentSpan}>Database origin</p>
					<p className={styles.popoverContentP}>{data.database_id}</p>
				</div>

				{data.tables.length > 0 && (
					<CitationSection title='Tables'>
						<div className={styles.citationSidePanelDiv3}>
							{data.tables.map((table) => (
								<span key={table.name} className={styles.citationSidePanelSpan}>
									{table.name}
								</span>
							))}
						</div>
					</CitationSection>
				)}

				<CitationSection title='Column Lineage'>
					<LineageTree node={data.column_lineage} depth={0} />
				</CitationSection>
			</div>
		</div>
	);
}

function CitationSection({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div>
			<div className={styles.citationSectionDiv}>{title}</div>
			{children}
		</div>
	);
}

function LineageTree({ node, depth }: { node: ColumnLineageNode; depth: number }) {
	const label = node.source_name ? `${node.source_name}.${node.name}` : node.name;

	return (
		<div style={{ paddingLeft: depth * 12 }}>
			<div className={styles.popoverContentP}>
				{depth > 0 && <span className={styles.lineageTreeSpan}>←</span>}
				<span className={depth === 0 ? styles.lineageTreeSpan2 : ''}>{label}</span>
				{node.expression && <span className={styles.lineageTreeSpan3}>({node.expression})</span>}
				{node.reference_node_name && (
					<span className={styles.lineageTreeSpan4}>{node.reference_node_name}</span>
				)}
			</div>
			{node.sources.map((child, i) => (
				<LineageTree key={i} node={child} depth={depth + 1} />
			))}
		</div>
	);
}
