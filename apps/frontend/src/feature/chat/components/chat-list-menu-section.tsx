import { useState } from 'react';
import { ChevronDown, RotateCw } from 'lucide-react';

import styles from './chat-list-menu-section.module.css';
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { getTimeAgo } from '@/lib/time-ago';

const MAX_COLLAPSED_CHATS = 5;

export function ChatListSection({
	title,
	query,
	chats,
	hasSeparator = true,
	onOpen,
}: {
	title: string;
	query: { isError: boolean; refetch: () => unknown };
	chats: { chatId: string; title: string; updatedAt: string | Date }[];
	hasSeparator?: boolean;
	onOpen: (chatId: string) => void;
}) {
	const [isExpanded, setIsExpanded] = useState(false);

	if (!query.isError && chats.length === 0) {
		return null;
	}

	const listedChats = isExpanded ? chats : chats.slice(0, MAX_COLLAPSED_CHATS);
	const hiddenCount = chats.length - listedChats.length;

	return (
		<>
			{hasSeparator && <DropdownMenuSeparator />}
			<DropdownMenuLabel className={styles.chatListSectionDropdownMenuLabel}>
				<span>{title}</span>
				<span className={styles.chatListSectionSpan}>{chats.length}</span>
			</DropdownMenuLabel>
			{query.isError && (
				<DropdownMenuItem
					onSelect={(event) => {
						event.preventDefault();
						query.refetch();
					}}
				>
					<RotateCw strokeWidth={2.25} />
					<span>Couldn't load, retry</span>
				</DropdownMenuItem>
			)}
			{listedChats.map((chat) => (
				<DropdownMenuItem
					key={chat.chatId}
					onSelect={() => onOpen(chat.chatId)}
					className={styles.chatListSectionDropdownMenuItem}
				>
					<span className={styles.chatListSectionSpan2}>{chat.title}</span>
					<span className={styles.chatListSectionSpan3}>
						{getTimeAgo(new Date(chat.updatedAt).getTime()).humanReadable}
					</span>
				</DropdownMenuItem>
			))}
			{hiddenCount > 0 && (
				<DropdownMenuItem
					onSelect={(event) => {
						event.preventDefault();
						setIsExpanded(true);
					}}
					className={styles.chatListSectionDropdownMenuItem2}
				>
					<ChevronDown strokeWidth={2.25} />
					<span>Show {hiddenCount} older</span>
				</DropdownMenuItem>
			)}
		</>
	);
}
