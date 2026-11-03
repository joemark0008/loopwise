import { MessageSquare } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import styles from './viewer-shared-items.module.css';
import type { ReactNode } from 'react';
import type { SharedGroup, SharedItem } from '@/lib/viewer-home';
import type { MessageBubble, StoryPanelDisplayMode } from '@loopwise/shared/types';
import {
	AuthorDateLabel,
	CardsGrid,
	CardsSection,
	GRID_CARD_CLASS,
	GRID_THUMBNAIL_CLASS,
	GridCardFooter,
	LINES_CARD_CLASS,
	LiveBadge,
	SharingBadge,
} from '@/components/item-card';
import { formatRelativeDate } from '@/lib/time-ago';
import { cn } from '@/lib/utils';

export function ViewerGroups({ groups, displayMode }: { groups: SharedGroup[]; displayMode: StoryPanelDisplayMode }) {
	return (
		<>
			{groups.map((group, index) => (
				<CardsSection
					key={group.label}
					title={group.label}
					className={index < groups.length - 1 ? styles.viewerGroupsCardsSection : undefined}
				>
					<CardsGrid displayMode={displayMode}>
						{group.items.map((item) => (
							<SharedChatCard key={item.id} item={item} displayMode={displayMode} />
						))}
					</CardsGrid>
				</CardsSection>
			))}
		</>
	);
}

export function ViewerEmptyState() {
	return (
		<div className={styles.viewerEmptyStateDiv}>
			<MessageSquare className={styles.viewerEmptyStateStoryIcon} />
			<p className={styles.viewerEmptyStateP}>No shared content yet.</p>
			<p className={styles.viewerEmptyStateP2}>Chats shared with you will appear here.</p>
		</div>
	);
}

function SharedChatCard({ item, displayMode }: { item: SharedItem; displayMode: StoryPanelDisplayMode }) {
	if (displayMode === 'lines') {
		return (
			<Link to='/shared-chat/$shareId' params={{ shareId: item.id }} className={LINES_CARD_CLASS}>
				<SharedItemLine item={item} icon={<MessageSquare className={styles.sharedStoryCardStoryIcon} />} />
			</Link>
		);
	}

	return (
		<Link to='/shared-chat/$shareId' params={{ shareId: item.id }} className={GRID_CARD_CLASS}>
			<SharedItemGrid item={item} thumbnail={<ChatThumbnail bubbles={item.messageBubbles} />} />
		</Link>
	);
}

function SharedItemLine({ item, icon }: { item: SharedItem; icon: ReactNode }) {
	return (
		<>
			{icon}
			<span className={styles.sharedItemLineSpan}>{item.title}</span>
			<SharedItemBadges item={item} mode='lines' />
			<span className={styles.sharedItemLineSpan2}>
				{`${item.authorName} · ${formatRelativeDate(item.createdAt)}`}
			</span>
		</>
	);
}

function SharedItemGrid({ item, thumbnail }: { item: SharedItem; thumbnail: ReactNode }) {
	return (
		<>
			<div className={GRID_THUMBNAIL_CLASS}>{thumbnail}</div>
			<div className={styles.sharedItemGridDiv}>
				<div className={styles.sharedItemGridDiv2}>
					<GridCardFooter
						title={item.title}
						subtitle={<AuthorDateLabel author={item.authorName} createdAt={item.createdAt} />}
					/>
					<SharedItemBadges item={item} mode='grid' />
				</div>
			</div>
		</>
	);
}

function SharedItemBadges({ item, mode }: { item: SharedItem; mode: 'grid' | 'lines' }) {
	const showSharing = mode === 'grid' ? item.visibility === 'specific' : !!item.visibility;
	if (!item.isLive && !showSharing) {
		return null;
	}

	return (
		<div className={styles.sharedItemBadgesDiv}>
			{item.isLive && <LiveBadge iconOnly={mode === 'grid'} />}
			{showSharing && item.visibility && (
				<SharingBadge
					visibility={item.visibility}
					sharedWithCount={item.sharedWithCount}
					sharedWithGroupCount={item.sharedWithGroupCount}
				/>
			)}
		</div>
	);
}

function ChatThumbnail({ bubbles, className }: { bubbles?: MessageBubble[]; className?: string }) {
	return (
		<div className={cn(styles.chatThumbnailSheet, className)}>
			{!bubbles || bubbles.length === 0 ? (
				<div className={styles.chatThumbnailDiv}>
					<MessageSquare className={styles.chatThumbnailMessageSquare} strokeWidth={1} />
				</div>
			) : (
				<ChatBubbles bubbles={bubbles} />
			)}
		</div>
	);
}

function ChatBubbles({ bubbles }: { bubbles: MessageBubble[] }) {
	const maxChars = Math.max(...bubbles.map((b) => b.charCount), 1);

	return (
		<>
			{bubbles.map((bubble, i) =>
				bubble.role === 'user' ? (
					<UserBubble key={i} charCount={bubble.charCount} maxChars={maxChars} />
				) : (
					<AssistantResponseLines key={i} charCount={bubble.charCount} />
				),
			)}
		</>
	);
}

const USER_BUBBLE_BORDER = styles.uSERBUBBLEBORDER;
const USER_BUBBLE_LINE = styles.uSERBUBBLELINE;
const USER_BUBBLE_LINE_WIDTHS = [
	styles.uSERBUBBLELINEWIDTHS,
	styles.uSERBUBBLELINEWIDTHS2,
	styles.uSERBUBBLELINEWIDTHS3,
];

function UserBubble({ charCount, maxChars }: { charCount: number; maxChars: number }) {
	const ratio = Math.max(charCount / maxChars, 0.15);
	const widthPercent = 35 + ratio * 55;
	const lineCount = Math.max(1, Math.min(Math.round(charCount / 60), 3));

	return (
		<div className={cn(styles.userBubbleDiv, USER_BUBBLE_BORDER)} style={{ width: `${Math.round(widthPercent)}%` }}>
			{Array.from({ length: lineCount }, (_, i) => (
				<div
					key={i}
					className={cn(
						styles.userBubbleDiv2,
						USER_BUBBLE_LINE,
						USER_BUBBLE_LINE_WIDTHS[i % USER_BUBBLE_LINE_WIDTHS.length],
					)}
				/>
			))}
		</div>
	);
}

const ASSISTANT_LINE_WIDTHS = [
	styles.aSSISTANTLINEWIDTHS,
	styles.aSSISTANTLINEWIDTHS2,
	styles.aSSISTANTLINEWIDTHS3,
	styles.aSSISTANTLINEWIDTHS4,
	styles.uSERBUBBLELINEWIDTHS2,
	styles.uSERBUBBLELINEWIDTHS3,
];

function AssistantResponseLines({ charCount }: { charCount: number }) {
	const lineCount = Math.max(2, Math.min(Math.round(charCount / 80), 6));

	return (
		<div className={styles.assistantResponseLinesDiv}>
			{Array.from({ length: lineCount }, (_, i) => (
				<div
					key={i}
					className={cn(
						styles.assistantResponseLinesDiv2,
						ASSISTANT_LINE_WIDTHS[i % ASSISTANT_LINE_WIDTHS.length],
					)}
				/>
			))}
		</div>
	);
}
