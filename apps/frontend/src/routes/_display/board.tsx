import { createFileRoute } from '@tanstack/react-router';
import { QueueBoardPage } from '@/feature/scheduling/queue-board-page';

export const Route = createFileRoute('/_display/board')({
	component: QueueBoardPage,
});
