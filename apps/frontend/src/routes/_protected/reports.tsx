import { createFileRoute } from '@tanstack/react-router';
import { ReportsLibraryPage } from '@/feature/reports/reports-library-page';

export const Route = createFileRoute('/_protected/reports')({
	component: ReportsLibraryPage,
});
