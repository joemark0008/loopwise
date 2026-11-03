import type { LucideIcon } from 'lucide-react';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageHeader, PageSection } from '@/components/clinical/page-header';
import pageStyles from '@/components/clinical/page.module.css';

/**
 * The layout of a screen whose feature is not built yet (DESIGN.md §14): its header, its table's columns and an empty
 * state naming what fills it, so the feature slots in without a new layout.
 */
export function PlannedPage({
	title,
	subtitle,
	icon,
	listTitle,
	columns,
	emptyTitle,
	emptyBody,
}: {
	title: string;
	subtitle: string;
	icon: LucideIcon;
	listTitle: string;
	columns: string[];
	emptyTitle: string;
	emptyBody: string;
}) {
	return (
		<div className={pageStyles.page}>
			<PageHeader title={title} subtitle={subtitle} />
			<PageSection title={listTitle} meta='0'>
				<div className={pageStyles.tableScroll}>
					<table className={pageStyles.table}>
						<thead>
							<tr>
								{columns.map((column) => (
									<th key={column} scope='col'>
										{column}
									</th>
								))}
							</tr>
						</thead>
					</table>
				</div>
				<EmptyState icon={icon} title={emptyTitle}>
					{emptyBody}
				</EmptyState>
			</PageSection>
		</div>
	);
}
