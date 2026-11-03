import { memo, type ReactNode, useEffect, useMemo, useState } from 'react';

import { type ClassNameMerger, joinClassNames } from './class-names';
import type { DateFormatSettings } from './date';
import {
	formatCellValue,
	formatColumnLabel,
	isNumericColumn,
	type SortDirection,
	sortTableRows,
} from './story-table-utils';

type TableRow = Record<string, unknown>;

export interface TablePaginationProps {
	totalRows: number;
	pageIndex: number;
	pageSize: number;
	pageCount: number;
	onPageChange: (page: number) => void;
	onPageSizeChange: (size: number) => void;
}

export type TableSort = { column: string; direction: SortDirection };

/** Rows paged and sorted by the server: `data` then only holds the current page, already sorted. */
export interface TableServerPagination {
	totalRows: number;
	pageIndex: number;
	pageSize: number;
	sort: TableSort | null;
	onPageChange: (page: number) => void;
	onPageSizeChange: (size: number) => void;
	onSortChange: (sort: TableSort | null) => void;
}

export interface TableDisplayProps {
	data: TableRow[];
	serverPagination?: TableServerPagination;
	columns?: string[];
	columnLabels?: Record<string, string>;
	title?: string;
	className?: string;
	tableContainerClassName?: string;
	emptyLabel?: string;
	showRowCount?: boolean;
	maxRowsBeforePagination?: number;
	compactFooter?: boolean;
	cellBackground?: (column: string, value: unknown) => string | undefined;
	headerBackground?: (column: string) => string | undefined;
	humanizeColumnLabels?: boolean;
	dateFormat?: DateFormatSettings | null;
	renderPagination: (pagination: TablePaginationProps & { compact: boolean }) => ReactNode;
	cn?: ClassNameMerger;
}

interface TablePaging {
	pageData: TableRow[];
	totalRows: number;
	showPagination: boolean;
	pageIndex: number;
	pageSize: number;
	pageCount: number;
	sort: TableSort | null;
	setPageIndex: (page: number) => void;
	setPageSize: (size: number) => void;
	toggleSort: (column: string) => void;
}

/** `quarry-table-display__*` classes let sandboxed custom stories style the same markup. */
export const TableDisplay = memo(function TableDisplay({
	data,
	serverPagination,
	columns,
	columnLabels,
	title,
	className,
	tableContainerClassName,
	emptyLabel = 'No rows returned',
	showRowCount = true,
	maxRowsBeforePagination = 100,
	compactFooter = false,
	cellBackground,
	headerBackground,
	humanizeColumnLabels = false,
	dateFormat,
	renderPagination,
	cn = joinClassNames,
}: TableDisplayProps) {
	const resolvedColumns = useMemo(
		() => (columns && columns.length > 0 ? columns : inferColumns(data)),
		[columns, data],
	);
	const numericColumns = useMemo(
		() => new Set(resolvedColumns.filter((column) => isNumericColumn(data, column))),
		[data, resolvedColumns],
	);
	const hasRows = data.length > 0;
	const paging = useTablePaging(data, resolvedColumns, maxRowsBeforePagination, serverPagination);
	const { pageData, pageIndex, pageSize, sort: activeSort } = paging;

	const columnMinWidths = useMemo(
		() => computeColumnMinWidths(data, resolvedColumns, dateFormat),
		[data, resolvedColumns, dateFormat],
	);

	function columnLabel(column: string) {
		return columnLabels?.[column] ?? (humanizeColumnLabels ? formatColumnLabel(column) : column);
	}

	return (
		<div className={cn('quarry-shared-tabledisplaydiv-555def quarry-table-display', className)}>
			{title ? (
				<span className='quarry-shared-tabledisplayspan-acadca quarry-table-display__title'>{title}</span>
			) : null}

			<div
				className={cn(
					'quarry-shared-tabledisplaydiv-2aa2d0 quarry-table-display__scroll',
					tableContainerClassName,
				)}
			>
				<table className='quarry-shared-tabledisplaytable-3c8cbd'>
					<thead className='quarry-shared-tabledisplaythead-532791'>
						<tr>
							<th className='quarry-shared-tabledisplayth-3513f5 quarry-table-display__index' />
							{resolvedColumns.map((column) => {
								const alignRight = numericColumns.has(column);
								const sortDirection = activeSort?.column === column ? activeSort.direction : null;
								const background = headerBackground?.(column);
								return (
									<th
										key={column}
										style={background ? { backgroundColor: background } : undefined}
										aria-sort={
											sortDirection
												? sortDirection === 'asc'
													? 'ascending'
													: 'descending'
												: 'none'
										}
										className={cn(
											'quarry-shared-tabledisplayth-df8127',
											alignRight &&
												'quarry-shared-tabledisplayth-a01bce quarry-table-display__numeric',
										)}
									>
										<button
											type='button'
											onClick={() => paging.toggleSort(column)}
											className='quarry-shared-tabledisplaybutton-9f278e group'
										>
											<span className={cn(alignRight && 'quarry-shared-tabledisplayspan-fb56d9')}>
												{columnLabel(column)}
											</span>
											<SortIndicator direction={sortDirection} cn={cn} />
										</button>
									</th>
								);
							})}
						</tr>
					</thead>

					<tbody>
						{hasRows ? (
							pageData.map((row, rowIndex) => (
								<tr key={rowIndex} className='quarry-shared-tabledisplaytr-b7b16d'>
									<td className='quarry-shared-tabledisplaytd-ecce13 quarry-table-display__index'>
										<span className='quarry-shared-tabledisplayspan-a04514'>
											{pageIndex * pageSize + rowIndex + 1}
										</span>
									</td>
									{resolvedColumns.map((column) => {
										const value = row[column];
										const isNull = value === null || value === undefined;
										const background = cellBackground?.(column, value);
										return (
											<td
												key={`${rowIndex}-${column}`}
												style={{
													minWidth: columnMinWidths[column],
													...(background ? { backgroundColor: background } : {}),
												}}
												className={cn(
													'quarry-shared-tabledisplaytd-0e23ef quarry-table-display__cell',
													numericColumns.has(column) &&
														'quarry-shared-tabledisplaytd-a01bce quarry-table-display__numeric',
												)}
											>
												{isNull ? (
													<span className='quarry-shared-tabledisplayspan-eb2299 quarry-table-display__null'>
														NULL
													</span>
												) : (
													formatCellValue(value, dateFormat)
												)}
											</td>
										);
									})}
								</tr>
							))
						) : (
							<tr>
								<td
									colSpan={resolvedColumns.length + 1}
									className='quarry-shared-tabledisplaytd-5a87e7 quarry-table-display__empty'
								>
									{emptyLabel}
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>

			{paging.showPagination ? (
				renderPagination({
					compact: compactFooter,
					totalRows: paging.totalRows,
					pageIndex,
					pageSize,
					pageCount: paging.pageCount,
					onPageChange: paging.setPageIndex,
					onPageSizeChange: paging.setPageSize,
				})
			) : showRowCount ? (
				<div
					className={cn(
						'quarry-shared-tabledisplaydiv-469660 quarry-table-display__row-count',
						compactFooter ? 'quarry-shared-tabledisplaydiv-4b5cc1' : 'quarry-shared-tabledisplaydiv-77c08e',
					)}
				>
					<span
						className={cn(
							'quarry-shared-tabledisplayspan-bfa603',
							compactFooter
								? 'quarry-shared-tabledisplayspan-359090'
								: 'quarry-shared-tabledisplayspan-fc7473',
						)}
					>
						{paging.totalRows} rows
					</span>
				</div>
			) : null}
		</div>
	);
});

function useTablePaging(
	data: TableRow[],
	columns: string[],
	maxRowsBeforePagination: number,
	serverPagination: TableServerPagination | undefined,
): TablePaging {
	const localPaging = useLocalTablePaging(data, columns, maxRowsBeforePagination);
	if (!serverPagination) {
		return localPaging;
	}

	const { totalRows, pageIndex, pageSize, sort } = serverPagination;
	return {
		pageData: data,
		totalRows,
		showPagination: totalRows > maxRowsBeforePagination,
		pageIndex,
		pageSize,
		pageCount: Math.ceil(totalRows / pageSize),
		sort,
		setPageIndex: serverPagination.onPageChange,
		setPageSize: serverPagination.onPageSizeChange,
		toggleSort: (column) => serverPagination.onSortChange(nextSort(sort, column)),
	};
}

function useLocalTablePaging(data: TableRow[], columns: string[], maxRowsBeforePagination: number): TablePaging {
	const [pageIndex, setPageIndex] = useState(0);
	const [pageSize, setPageSize] = useState(maxRowsBeforePagination);
	const [defaultPageSize, setDefaultPageSize] = useState(maxRowsBeforePagination);
	const [sort, setSort] = useState<TableSort | null>(null);

	if (defaultPageSize !== maxRowsBeforePagination) {
		setDefaultPageSize(maxRowsBeforePagination);
		setPageSize(maxRowsBeforePagination);
		setPageIndex(0);
	}

	useEffect(() => setPageIndex(0), [data]);

	const activeSort = sort && columns.includes(sort.column) ? sort : null;
	const sortedData = useMemo(
		() => (activeSort ? sortTableRows(data, activeSort.column, activeSort.direction) : data),
		[data, activeSort],
	);
	const showPagination = data.length > 0 && data.length > maxRowsBeforePagination;
	const pageData = useMemo(
		() => (showPagination ? sortedData.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize) : sortedData),
		[sortedData, pageIndex, pageSize, showPagination],
	);

	return {
		pageData,
		totalRows: data.length,
		showPagination,
		pageIndex,
		pageSize,
		pageCount: Math.ceil(sortedData.length / pageSize),
		sort: activeSort,
		setPageIndex,
		setPageSize: (size) => {
			setPageSize(size);
			setPageIndex(0);
		},
		toggleSort: (column) => {
			setPageIndex(0);
			setSort(nextSort(activeSort, column));
		},
	};
}

function SortIndicator({ direction, cn }: { direction: SortDirection | null; cn: ClassNameMerger }) {
	return (
		<span className='quarry-shared-sortindicatorspan-0eb978 quarry-table-display__sort'>
			<ChevronIcon
				path='m18 15-6-6-6 6'
				className={cn(
					'quarry-shared-sortindicatorchevronicon-ef2d6f',
					direction === 'asc'
						? 'quarry-shared-sortindicatorchevronicon-d4108a quarry-table-display__sort--active'
						: 'quarry-shared-sortindicatorchevronicon-3a33f1',
				)}
			/>
			<ChevronIcon
				path='m6 9 6 6 6-6'
				className={cn(
					'quarry-shared-sortindicatorchevronicon-ef2d6f',
					direction === 'desc'
						? 'quarry-shared-sortindicatorchevronicon-d4108a quarry-table-display__sort--active'
						: 'quarry-shared-sortindicatorchevronicon-3a33f1',
				)}
			/>
		</span>
	);
}

/** Same glyphs as lucide's ChevronUp/ChevronDown, inlined so shared code does not depend on an icon package. */
function ChevronIcon({ path, className }: { path: string; className: string }) {
	return (
		<svg
			xmlns='http://www.w3.org/2000/svg'
			viewBox='0 0 24 24'
			fill='none'
			stroke='currentColor'
			strokeWidth='2'
			strokeLinecap='round'
			strokeLinejoin='round'
			aria-hidden='true'
			className={className}
		>
			<path d={path} />
		</svg>
	);
}

function nextSort(current: TableSort | null, column: string): TableSort | null {
	if (!current || current.column !== column) {
		return { column, direction: 'asc' };
	}
	if (current.direction === 'asc') {
		return { column, direction: 'desc' };
	}
	return null;
}

function computeColumnMinWidths(
	data: TableRow[],
	columns: string[],
	dateFormat?: DateFormatSettings | null,
): Record<string, string> {
	const widths: Record<string, string> = {};
	for (const column of columns) {
		let maxChars = 0;
		for (const row of data) {
			const chars = formatCellValue(row[column], dateFormat).length;
			if (chars > maxChars) {
				maxChars = chars;
			}
		}
		widths[column] = `calc(${maxChars}ch + 1.5rem)`;
	}
	return widths;
}

function inferColumns(data: TableRow[]): string[] {
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
