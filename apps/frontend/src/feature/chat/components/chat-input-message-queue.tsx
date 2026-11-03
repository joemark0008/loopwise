import { useState } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import {
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, CornerDownLeft, GripVertical, Pencil, Trash2 } from 'lucide-react';
import styles from './chat-input-message-queue.module.css';
import type { DragEndEvent } from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { useMessageQueueStore } from '@/hooks/use-message-queue-store';
import { useChatId } from '@/hooks/use-chat-id';
import { cn } from '@/lib/utils';
import { messageQueueStore } from '@/stores/chat-message-queue';

interface ChatInputMessageQueueProps {
	onEditMessage?: (text: string) => void;
	onSubmitNow?: (messageId: string) => Promise<void>;
}

export const ChatInputMessageQueue = ({ onEditMessage, onSubmitNow }: ChatInputMessageQueueProps) => {
	const chatId = useChatId();
	const { queuedMessages } = useMessageQueueStore(chatId);
	const [isExpanded, setIsExpanded] = useState(true);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	if (!queuedMessages.length) {
		return null;
	}

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) {
			return;
		}
		const fromIndex = queuedMessages.findIndex((m) => m.id === active.id);
		const toIndex = queuedMessages.findIndex((m) => m.id === over.id);
		if (fromIndex !== -1 && toIndex !== -1) {
			messageQueueStore.reorder(chatId, fromIndex, toIndex);
		}
	};

	return (
		<div className={styles.chatInputMessageQueueDiv}>
			<button
				type='button'
				onClick={() => setIsExpanded(!isExpanded)}
				className={styles.chatInputMessageQueueButton}
			>
				<ChevronDown
					className={cn(
						styles.chatInputMessageQueueChevronDown,
						!isExpanded && styles.chatInputMessageQueueChevronDown2,
					)}
				/>
				<span>{queuedMessages.length} queued</span>
			</button>

			{isExpanded && (
				<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
					<SortableContext items={queuedMessages.map((m) => m.id)} strategy={verticalListSortingStrategy}>
						<div className={styles.chatInputMessageQueueDiv2}>
							{queuedMessages.map((qm, idx) => (
								<SortableQueuedMessageRow
									key={qm.id}
									chatId={chatId}
									messageId={qm.id}
									text={qm.text}
									isFirst={idx === 0}
									isDraggable={queuedMessages.length > 1}
									onEdit={onEditMessage}
									onSubmitNow={onSubmitNow}
								/>
							))}
						</div>
					</SortableContext>
				</DndContext>
			)}
		</div>
	);
};

function SortableQueuedMessageRow({
	chatId,
	messageId,
	text,
	isFirst,
	isDraggable,
	onEdit,
	onSubmitNow,
}: {
	chatId: string | undefined;
	messageId: string;
	text: string;
	isFirst: boolean;
	isDraggable: boolean;
	onEdit?: (text: string) => void;
	onSubmitNow?: (messageId: string) => Promise<void>;
}) {
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
		id: messageId,
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(
				`${styles.sortableQueuedMessageRowDiv} group`,
				!isFirst && styles.sortableQueuedMessageRowDiv2,
				isDragging && styles.sortableQueuedMessageRowDiv3,
			)}
		>
			{isDraggable && (
				<button
					ref={setActivatorNodeRef}
					type='button'
					className={styles.sortableQueuedMessageRowButton}
					{...attributes}
					{...listeners}
				>
					<GripVertical
						className={cn(
							styles.sortableQueuedMessageRowGripVertical,
							isFirst && styles.sortableQueuedMessageRowGripVertical2,
						)}
					/>
				</button>
			)}

			<span className={styles.sortableQueuedMessageRowSpan}>{text}</span>

			<div className={styles.sortableQueuedMessageRowDiv4}>
				{isFirst && (
					<span className={styles.sortableQueuedMessageRowSpan2}>
						<CornerDownLeft className={styles.sortableQueuedMessageRowCornerDownLeft} />
						<span>to submit</span>
					</span>
				)}

				<div className={styles.sortableQueuedMessageRowDiv5}>
					<Button
						variant='ghost-muted'
						size='icon-xs'
						className={styles.sortableQueuedMessageRowButton2}
						type='button'
						onClick={() => onSubmitNow?.(messageId)}
					>
						<CornerDownLeft className={styles.sortableQueuedMessageRowCornerDownLeft} />
					</Button>
					<Button
						variant='ghost-muted'
						size='icon-xs'
						className={styles.sortableQueuedMessageRowButton2}
						type='button'
						onClick={() => {
							messageQueueStore.remove(chatId, messageId);
							onEdit?.(text);
						}}
					>
						<Pencil className={styles.sortableQueuedMessageRowCornerDownLeft} />
					</Button>
					<Button
						variant='ghost-muted'
						size='icon-xs'
						className={styles.sortableQueuedMessageRowButton3}
						type='button'
						onClick={() => messageQueueStore.remove(chatId, messageId)}
					>
						<Trash2 className={styles.sortableQueuedMessageRowCornerDownLeft} />
					</Button>
				</div>
			</div>
		</div>
	);
}
