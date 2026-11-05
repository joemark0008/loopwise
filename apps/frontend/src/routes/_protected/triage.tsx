import { createFileRoute } from '@tanstack/react-router';
import { TriagePage } from '@/feature/scheduling/triage-page';

export const Route = createFileRoute('/_protected/triage')({
	component: TriagePage,
});
