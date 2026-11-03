import { createFileRoute } from '@tanstack/react-router';
import { RouteComponent } from '@/feature/chat/chat-layout';

export const Route = createFileRoute('/_protected/_chat-layout')({
	component: RouteComponent,
});
