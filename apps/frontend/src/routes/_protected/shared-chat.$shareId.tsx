import { createFileRoute } from '@tanstack/react-router';
import { SharedChatPage } from '@/feature/chat/shared-chat-page';

export const Route = createFileRoute('/_protected/shared-chat/$shareId')({
	component: SharedChatPage,
});
