import { createFileRoute } from '@tanstack/react-router';
import { RouteComponent } from '@/feature/chat/chat-page';

export const Route = createFileRoute('/_protected/_chat-layout/$chatId')({
	component: RouteComponent,
});
