import { createFileRoute } from '@tanstack/react-router';
import { WiseChatsPage } from '@/feature/wise-chats/wise-chats-page';

export const Route = createFileRoute('/_protected/chats')({
	component: WiseChatsPage,
});
