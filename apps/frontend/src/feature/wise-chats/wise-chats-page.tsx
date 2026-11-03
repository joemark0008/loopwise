import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { MessageSquare, Plus } from 'lucide-react';
import type { GroupedChatItem } from '@loopwise/shared/types';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageHeader, PageSection } from '@/components/clinical/page-header';
import pageStyles from '@/components/clinical/page.module.css';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { useTimeAgo } from '@/hooks/use-time-ago';
import { chatApi } from '@/lib/chat-api';

/**
 * Your general Wise chats (questions across patients). Chart chats stay on each patient's chart (DESIGN.md §9), so
 * the sidebar no longer carries a chat history.
 */
export function WiseChatsPage() {
	const chats = useQuery(chatApi.chat.listGrouped.queryOptions({ groupBy: 'none', filters: ['mine'] }));
	const items = chats.data?.groups.flatMap((group) => group.chats) ?? [];

	return (
		<div className={pageStyles.page}>
			<PageHeader
				title='Wise chats'
				subtitle='Questions to Wise across your patients. A patient’s own chat lives on their chart.'
				actions={
					<Button asChild>
						<Link to='/'>
							<Plus />
							New chat
						</Link>
					</Button>
				}
			/>
			<PageSection title='Recent' meta={chats.data ? items.length : undefined}>
				{chats.isPending ? (
					<Skeleton className={pageStyles.section} />
				) : chats.error ? (
					<ErrorMessage message={chats.error.message} />
				) : items.length === 0 ? (
					<EmptyState icon={MessageSquare} title='No chats yet'>
						Ask Wise from Today, or from a patient’s chart.
					</EmptyState>
				) : (
					<table className={pageStyles.table} data-reflow>
						<thead>
							<tr>
								<th scope='col'>Chat</th>
								<th scope='col'>Updated</th>
							</tr>
						</thead>
						<tbody>
							{items.map((chat) => (
								<ChatRow key={chat.id} chat={chat} />
							))}
						</tbody>
					</table>
				)}
			</PageSection>
		</div>
	);
}

function ChatRow({ chat }: { chat: GroupedChatItem }) {
	const timeAgo = useTimeAgo(chat.updatedAt);
	return (
		<tr>
			<td data-label='Chat'>
				{chat.kind === 'shared' && chat.shareId ? (
					<Link to='/shared-chat/$shareId' params={{ shareId: chat.shareId }}>
						{chat.title}
					</Link>
				) : (
					<Link to='/$chatId' params={{ chatId: chat.id }}>
						{chat.title}
					</Link>
				)}
			</td>
			<td data-label='Updated'>{timeAgo.humanReadable}</td>
		</tr>
	);
}
