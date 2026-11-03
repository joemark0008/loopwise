import { useQuery } from '@tanstack/react-query';
import { ChevronDown, MessageCircle } from 'lucide-react';

import { ChatListSection } from './chat-list-menu-section';
import styles from './shared-chat-button.module.css';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { requestAsk } from '@/stores/ask-bar';
import { chatApi } from '@/lib/chat-api';

/** Continues the shared chat, with the user's quick questions about it a chevron away. */
export function SharedChatButton({
	shareId,
	label,
	isPending = false,
	onClick,
}: {
	shareId: string;
	label: string;
	isPending?: boolean;
	onClick: () => void;
}) {
	const quickQuestions = useQuery(chatApi.chatFork.listSharedChatQuickQuestions.queryOptions({ shareId }));
	const chats = quickQuestions.data ?? [];
	const hasQuickQuestions = quickQuestions.isError || chats.length > 0;

	return (
		<div className={styles.sharedChatButtonDiv}>
			<Button
				variant='ghost'
				size='sm'
				className={cn(
					styles.sharedChatButtonButton,
					hasQuickQuestions ? styles.sharedChatButtonButton2 : styles.sharedChatButtonButton3,
				)}
				onClick={onClick}
				disabled={isPending}
			>
				{isPending ? (
					<Spinner className={styles.sharedChatButtonSpinner} />
				) : (
					<MessageCircle className={styles.sharedChatButtonMessageCircle} strokeWidth={2.25} />
				)}
				<span>{label}</span>
			</Button>
			{hasQuickQuestions && (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant='ghost'
							size='sm'
							className={styles.sharedChatButtonButton4}
							aria-label='Quick questions about this chat'
						>
							<ChevronDown className={styles.sharedChatButtonChevronDown} strokeWidth={2.25} />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align='end' className={styles.sharedChatButtonDropdownMenuContent}>
						<ChatListSection
							title='Quick questions'
							query={quickQuestions}
							chats={chats}
							hasSeparator={false}
							onOpen={(chatId) => requestAsk({ chatId })}
						/>
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</div>
	);
}
