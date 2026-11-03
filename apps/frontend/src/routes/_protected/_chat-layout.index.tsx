import { createFileRoute } from '@tanstack/react-router';
import { RouteComponent } from '@/feature/chat/new-chat-page';

export const Route = createFileRoute('/_protected/_chat-layout/')({
	validateSearch: (search: Record<string, unknown>): { admin?: boolean; example?: boolean } => ({
		admin: search.admin === true || search.admin === 'true' ? true : undefined,
		example: search.example === true || search.example === 'true' ? true : undefined,
	}),
	component: RouteComponent,
});
