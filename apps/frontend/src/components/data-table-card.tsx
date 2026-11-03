import { memo, useState } from 'react';
import { Copy, Download, Maximize2 } from 'lucide-react';
import styles from './data-table-card.module.css';
import type { ReactNode } from 'react';
import type { ColumnConditionalFormats } from '@quarry/shared/conditional-formatting';
import { ExportDataMenu } from '@/components/export-data-menu';
import { TableDisplay } from '@/feature/chat/components/tool-calls/display-table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useDateFormat } from '@/hooks/use-date-format';
import { tableToTsv } from '@/lib/table-export';
import { cn } from '@/lib/utils';

interface DataTableCardProps {
	columns: string[];
	data: Record<string, unknown>[];
	title?: string;
	className?: string;
	tableContainerClassName?: string;
	maxRowsBeforePagination?: number;
	conditionalFormats?: ColumnConditionalFormats;
	leadingHeader?: ReactNode;
	/** Extra toolbar controls rendered before the copy/download/fullscreen actions. */
	headerActions?: ReactNode;
}

export const DataTableCard = memo(
	({
		columns,
		data,
		title,
		className,
		tableContainerClassName,
		maxRowsBeforePagination = 10,
		conditionalFormats,
		leadingHeader,
		headerActions,
	}: DataTableCardProps) => {
		const [isFullscreen, setIsFullscreen] = useState(false);
		const dateFormat = useDateFormat();

		const resolvedColumns = columns.length > 0 ? columns : inferColumns(data);

		if (resolvedColumns.length === 0) {
			return null;
		}

		const handleCopy = () => navigator.clipboard.writeText(tableToTsv(resolvedColumns, data, dateFormat));
		return (
			<div data-slot='data-table-card' className={cn(styles.dataTableCardDiv, className)}>
				<div
					className={cn(
						styles.dataTableCardDiv2,
						title || leadingHeader ? styles.dataTableCardDiv3 : styles.dataTableCardDiv4,
					)}
				>
					{title || leadingHeader ? (
						<div className={styles.dataTableCardDiv5}>
							{leadingHeader}
							{title ? <span className={styles.dataTableCardSpan}>{title}</span> : null}
						</div>
					) : null}
					<div className={styles.dataTableCardDiv6}>
						{headerActions}
						<Button
							variant='ghost-muted'
							size='icon-xs'
							className={styles.dataTableCardButton}
							onClick={handleCopy}
							title='Copy rows'
						>
							<Copy className={styles.dataTableCardCopy} />
						</Button>
						<ExportDataMenu columns={resolvedColumns} data={data} filename={title || 'table'}>
							<Button
								variant='ghost-muted'
								size='icon-xs'
								className={styles.dataTableCardButton}
								title='Export data'
							>
								<Download className={styles.dataTableCardCopy} />
							</Button>
						</ExportDataMenu>
						<Button
							variant='ghost-muted'
							size='icon-xs'
							className={styles.dataTableCardButton}
							onClick={() => setIsFullscreen(true)}
							title='View fullscreen'
						>
							<Maximize2 className={styles.dataTableCardCopy} />
						</Button>
					</div>
				</div>

				<TableDisplay
					data={data}
					columns={resolvedColumns}
					tableContainerClassName={tableContainerClassName}
					maxRowsBeforePagination={maxRowsBeforePagination}
					compactFooter={true}
					conditionalFormats={conditionalFormats}
					humanizeColumnLabels={true}
				/>

				<Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
					<DialogContent className={styles.dataTableCardDialogContent}>
						<DialogTitle className='sr-only'>{title ?? 'Table'}</DialogTitle>
						<div className={styles.dataTableCardDiv7}>
							<Button
								variant='ghost-muted'
								size='icon-xs'
								className={styles.dataTableCardButton2}
								onClick={handleCopy}
								title='Copy rows'
							>
								<Copy className={styles.dataTableCardCopy2} />
							</Button>
							<ExportDataMenu columns={resolvedColumns} data={data} filename={title || 'table'}>
								<Button
									variant='ghost-muted'
									size='icon-xs'
									className={styles.dataTableCardButton2}
									title='Export data'
								>
									<Download className={styles.dataTableCardCopy2} />
								</Button>
							</ExportDataMenu>
						</div>
						<TableDisplay
							data={data}
							columns={resolvedColumns}
							className={styles.dataTableCardTableDisplay}
							tableContainerClassName={styles.dataTableCardTableDisplay2}
							maxRowsBeforePagination={maxRowsBeforePagination}
							compactFooter={true}
							conditionalFormats={conditionalFormats}
							humanizeColumnLabels={true}
						/>
					</DialogContent>
				</Dialog>
			</div>
		);
	},
);

function inferColumns(data: Record<string, unknown>[]): string[] {
	const seen = new Set<string>();
	const columns: string[] = [];

	for (const row of data) {
		for (const column of Object.keys(row)) {
			if (seen.has(column)) {
				continue;
			}
			seen.add(column);
			columns.push(column);
		}
	}

	return columns;
}
