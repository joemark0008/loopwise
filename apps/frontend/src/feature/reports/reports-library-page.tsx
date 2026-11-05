import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { FileText, Search, SearchX } from 'lucide-react';
import { useMemo, useState } from 'react';
import styles from './reports-library.module.css';
import type { MyReportsQuery } from '@/graphql/generated/graphql';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageHeader, PageSection } from '@/components/clinical/page-header';
import pageStyles from '@/components/clinical/page.module.css';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useTimeAgo } from '@/hooks/use-time-ago';
import { reportApi } from '@/lib/report-api';

type ReportRow = MyReportsQuery['myReports'][number];

/**
 * The reports library (DESIGN.md §7.2): every report Wise wrote in your chats, the latest version of each. A report
 * opens in its chat, in the side panel, where its versions, Print, PDF and Save to chart live.
 */
export function ReportsLibraryPage() {
	const reports = useQuery({ queryKey: reportApi.mine.queryKey, queryFn: reportApi.mine.fetch });
	const [search, setSearch] = useState('');
	const rows = useMemo(() => {
		const query = search.trim().toLowerCase();
		const all = reports.data ?? [];
		return query
			? all.filter((row) =>
					[row.title, row.patientName, row.chatTitle].some((text) => text?.toLowerCase().includes(query)),
				)
			: all;
	}, [reports.data, search]);

	return (
		<div className={pageStyles.page}>
			<PageHeader
				title='Reports'
				subtitle='Reports Wise wrote in your chats. Open one to see its versions, print it or save it to a chart.'
			/>
			<PageSection title='Your reports' meta={reports.data ? rows.length : undefined}>
				{reports.isPending ? (
					<Skeleton className={pageStyles.section} />
				) : reports.error ? (
					<ErrorMessage message={reports.error.message} />
				) : reports.data.length === 0 ? (
					<EmptyState icon={FileText} title='No reports yet'>
						Ask Wise for a report in a chat, for example “a report of my encounters per month”.
					</EmptyState>
				) : (
					<>
						<div className={styles.search} role='search'>
							<Search className={styles.searchIcon} aria-hidden />
							<Input
								className={styles.searchInput}
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								onKeyDown={(event) => event.key === 'Escape' && setSearch('')}
								placeholder='Search by title, patient or chat'
								aria-label='Search reports'
							/>
						</div>
						{rows.length === 0 ? (
							<EmptyState icon={SearchX} title='No matching reports'>
								Try another title, patient or chat name.
							</EmptyState>
						) : (
							<table className={pageStyles.table} data-reflow data-testid='reports-library'>
								<thead>
									<tr>
										<th scope='col'>Report</th>
										<th scope='col'>Patient</th>
										<th scope='col'>Chat</th>
										<th scope='col'>Updated</th>
									</tr>
								</thead>
								<tbody>
									{rows.map((row) => (
										<ReportRowView key={`${row.chatId}:${row.reportId}`} row={row} />
									))}
								</tbody>
							</table>
						)}
					</>
				)}
			</PageSection>
		</div>
	);
}

function ReportRowView({ row }: { row: ReportRow }) {
	const timeAgo = useTimeAgo(new Date(row.updatedAt).getTime());
	return (
		<tr>
			<td data-label='Report'>
				<Link to='/$chatId' params={{ chatId: row.chatId }} search={{ report: row.reportId }}>
					{row.title}
				</Link>{' '}
				<span className={styles.meta}>v{row.version}</span>
			</td>
			<td data-label='Patient'>
				{row.patientId && row.patientName ? (
					<Link to='/patients/$patientId' params={{ patientId: row.patientId }}>
						{row.patientName}
					</Link>
				) : (
					<span className={styles.meta}>—</span>
				)}
			</td>
			<td data-label='Chat'>{row.chatTitle}</td>
			<td data-label='Updated'>{timeAgo.humanReadable}</td>
		</tr>
	);
}
