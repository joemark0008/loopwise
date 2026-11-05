import { createFileRoute } from '@tanstack/react-router';
import { RouteComponent } from '@/feature/chat/chat-page';

/** `?report=<id>` opens that report of the chat in the side panel (links from the reports library). */
export const Route = createFileRoute('/_protected/_chat-layout/$chatId')({
	validateSearch: (search: Record<string, unknown>): { report?: string } =>
		typeof search.report === 'string' && search.report ? { report: search.report } : {},
	component: RouteComponent,
});
