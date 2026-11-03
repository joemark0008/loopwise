import { createFileRoute } from '@tanstack/react-router';
import { ResultsInboxPage } from '@/feature/results/results-inbox-page';

export const Route = createFileRoute('/_protected/results')({
	component: ResultsInboxPage,
});
