import { createFileRoute } from '@tanstack/react-router';
import { QueuePage } from '@/feature/scheduling/queue-page';

export const Route = createFileRoute('/_protected/queue')({
	component: QueuePage,
});
