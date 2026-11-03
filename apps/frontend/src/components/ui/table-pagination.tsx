import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

import styles from './table-pagination.module.css';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface TablePaginationProps {
	totalRows: number;
	pageIndex: number;
	pageSize: number;
	pageCount: number;
	pageSizeOptions?: number[];
	onPageChange: (page: number) => void;
	onPageSizeChange: (size: number) => void;
}

export function TablePagination({
	totalRows,
	pageIndex,
	pageSize,
	pageCount,
	pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
	onPageChange,
	onPageSizeChange,
}: TablePaginationProps) {
	const canPrevious = pageIndex > 0;
	const canNext = pageIndex < pageCount - 1;

	return (
		<div className={styles.tablePaginationDiv}>
			<div className={styles.tablePaginationDiv2}>
				<span className={styles.tablePaginationSpan}>{totalRows} rows</span>

				<div className={styles.tablePaginationDiv3}>
					<div className={styles.tablePaginationDiv4}>
						<span className={styles.tablePaginationSpan}>Rows per page</span>
						<Select value={`${pageSize}`} onValueChange={(v) => onPageSizeChange(Number(v))}>
							<SelectTrigger size='sm' variant='default'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent align='end'>
								{pageSizeOptions.map((size) => (
									<SelectItem key={size} value={`${size}`}>
										{size}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<span className={styles.tablePaginationSpan}>
						Page {pageCount === 0 ? 0 : pageIndex + 1} of {pageCount}
					</span>

					<div className={styles.tablePaginationDiv5}>
						<Button
							type='button'
							variant='outline'
							size='icon-sm'
							onClick={() => onPageChange(0)}
							disabled={!canPrevious}
							aria-label='Go to first page'
						>
							<ChevronsLeft />
						</Button>
						<Button
							type='button'
							variant='outline'
							size='icon-sm'
							onClick={() => onPageChange(pageIndex - 1)}
							disabled={!canPrevious}
							aria-label='Go to previous page'
						>
							<ChevronLeft />
						</Button>
						<Button
							type='button'
							variant='outline'
							size='icon-sm'
							onClick={() => onPageChange(pageIndex + 1)}
							disabled={!canNext}
							aria-label='Go to next page'
						>
							<ChevronRight />
						</Button>
						<Button
							type='button'
							variant='outline'
							size='icon-sm'
							onClick={() => onPageChange(pageCount - 1)}
							disabled={!canNext}
							aria-label='Go to last page'
						>
							<ChevronsRight />
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
