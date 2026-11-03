import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Copy, Check, Ellipsis, ClipboardCopy, FileText } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import styles from './assistant-message-actions.module.css';
import type { UIMessage } from '@loopwise/api/agent/types/chat';
import type { FormEvent, KeyboardEvent } from 'react';
import type { Chat } from '@/queries/use-chat-query';
import { useChatQuery } from '@/queries/use-chat-query';
import { Button } from '@/components/ui/button';
import { ConfettiBurst } from '@/feature/chat/components/confetti-burst';
import { cn } from '@/lib/utils';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useAgentMessagesGetter } from '@/contexts/agent.provider';
import { getMessageMarkdown, getChatMarkdown } from '@/lib/serialize-message';
import { downloadTextFile, toFileSlug } from '@/lib/export-chat';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { chatApi } from '@/lib/chat-api';

export function AssistantMessageActions({
	message,
	className,
	chatId,
}: {
	message: UIMessage;
	className?: string;
	chatId: string;
}) {
	const [feedbackDialogVote, setFeedbackDialogVote] = useState<FeedbackVote>('down');
	const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
	const [feedbackCelebration, setFeedbackCelebration] = useState<FeedbackCelebration | null>(null);
	const [includeErrors, setIncludeErrors] = useState(false);
	const { isCopied, copy } = useCopyToClipboard();
	const getAgentMessages = useAgentMessagesGetter();
	const { data: chat } = useChatQuery({ chatId, select: selectChatExportMetadata });

	const chatTitle = chat?.title ?? 'Loopwise chat';
	const chatMetadata = { title: chatTitle, createdAt: chat?.createdAt, updatedAt: chat?.updatedAt };
	const exportOptions = { includeErrors };

	const buildChatMarkdown = () => {
		const agentMessages = getAgentMessages();
		const chatMessages = agentMessages.length > 0 ? agentMessages : [message];
		return getChatMarkdown(chatMessages, exportOptions, chatMetadata);
	};

	const handleCopyChat = () => copy(buildChatMarkdown());

	const handleExportMarkdown = () => {
		downloadTextFile(`${toFileSlug(chatTitle)}.md`, buildChatMarkdown(), 'text/markdown');
	};

	const submitFeedback = useMutation(
		chatApi.feedback.submit.mutationOptions({
			onSuccess: (data, variables, __, ctx) => {
				setFeedbackCelebration((prev) => ({ vote: variables.vote, key: (prev?.key ?? 0) + 1 }));
				ctx.client.setQueryData(chatApi.chat.get.queryKey({ chatId }), (prev) =>
					prev
						? {
								...prev,
								messages: prev.messages.map((m) =>
									m.id === message.id ? { ...m, feedback: data } : m,
								),
							}
						: prev,
				);
			},
		}),
	);

	const handlePositiveFeedbackClick = () => {
		setFeedbackDialogVote('up');
		setFeedbackDialogOpen(true);
	};

	const handleNegativeFeedbackClick = () => {
		setFeedbackDialogVote('down');
		setFeedbackDialogOpen(true);
	};

	const handleFeedbackSubmit = (explanation?: string) => {
		submitFeedback.mutate({
			chatId,
			messageId: message.id,
			vote: feedbackDialogVote,
			explanation,
		});
		setFeedbackDialogOpen(false);
	};

	return (
		<>
			<div className={cn(styles.assistantMessageActionsDiv, className)}>
				<FeedbackButton
					vote='up'
					isSelected={message.feedback?.vote === 'up'}
					celebrationKey={feedbackCelebration?.vote === 'up' ? feedbackCelebration.key : undefined}
					disabled={submitFeedback.isPending}
					onClick={handlePositiveFeedbackClick}
				/>

				<FeedbackButton
					vote='down'
					isSelected={message.feedback?.vote === 'down'}
					celebrationKey={feedbackCelebration?.vote === 'down' ? feedbackCelebration.key : undefined}
					disabled={submitFeedback.isPending}
					onClick={handleNegativeFeedbackClick}
				/>

				<Button
					variant='ghost'
					size='icon-sm'
					onClick={() => copy(getMessageMarkdown(message, exportOptions))}
					className={styles.assistantMessageActionsButton}
					aria-label='Copy message'
				>
					{isCopied ? (
						<Check className={styles.assistantMessageActionsCheck} />
					) : (
						<Copy className={styles.assistantMessageActionsCheck} />
					)}
				</Button>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant='ghost'
							size='icon-sm'
							className={styles.assistantMessageActionsButton}
							aria-label='More actions'
						>
							<Ellipsis className={styles.assistantMessageActionsCheck} />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align='start' className={styles.assistantMessageActionsDropdownMenuContent}>
						<label className={styles.assistantMessageActionsLabel} onClick={(e) => e.stopPropagation()}>
							<span>Include errors</span>
							<Switch checked={includeErrors} onCheckedChange={setIncludeErrors} />
						</label>
						<DropdownMenuSeparator />
						<DropdownMenuItem onSelect={handleCopyChat}>
							<ClipboardCopy />
							<span>Copy chat to Markdown</span>
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={handleExportMarkdown}>
							<FileText />
							<span>Export chat to Markdown</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<FeedbackDialog
				open={feedbackDialogOpen}
				onOpenChange={setFeedbackDialogOpen}
				onSubmit={handleFeedbackSubmit}
				isPending={submitFeedback.isPending}
				vote={feedbackDialogVote}
			/>
		</>
	);
}

function FeedbackButton({
	vote,
	isSelected,
	celebrationKey,
	disabled,
	onClick,
}: {
	vote: FeedbackVote;
	isSelected: boolean;
	celebrationKey?: number;
	disabled: boolean;
	onClick: () => void;
}) {
	const { Icon, label, selectedClassName, iconAnimationClassName, confettiColors } = FEEDBACK_BUTTON_CONFIG[vote];
	const isCelebrating = celebrationKey !== undefined;

	return (
		<Button
			variant='ghost'
			size='icon-sm'
			onClick={onClick}
			disabled={disabled}
			className={cn(
				styles.feedbackButtonButton,
				isSelected ? cn(selectedClassName, styles.feedbackButtonButton2) : styles.feedbackButtonButton3,
			)}
			aria-label={label}
		>
			<Icon
				key={`icon-${celebrationKey}`}
				className={cn(styles.assistantMessageActionsCheck, isCelebrating && iconAnimationClassName)}
			/>
			{isCelebrating && (
				<ConfettiBurst
					key={`confetti-${celebrationKey}`}
					count={10}
					distancePx={16}
					distanceStepPx={5}
					colors={confettiColors}
					pieceClassName={styles.feedbackButtonConfettiBurst}
				/>
			)}
		</Button>
	);
}

const FEEDBACK_BUTTON_CONFIG = {
	up: {
		Icon: ThumbsUp,
		label: 'Good response',
		selectedClassName: styles.fEEDBACKBUTTONCONFIGSelectedClassName,
		iconAnimationClassName: 'thumb-up-pop',
		confettiColors: buildConfettiShades('var(--color-green-500)'),
	},
	down: {
		Icon: ThumbsDown,
		label: 'Bad response',
		selectedClassName: styles.fEEDBACKBUTTONCONFIGSelectedClassName2,
		iconAnimationClassName: 'thumb-down-pop',
		confettiColors: buildConfettiShades('var(--color-red-500)'),
	},
} satisfies Record<FeedbackVote, unknown>;

function buildConfettiShades(baseColor: string) {
	return [
		baseColor,
		`color-mix(in oklab, ${baseColor} 60%, white)`,
		`color-mix(in oklab, ${baseColor} 80%, black)`,
		'var(--chart-1)',
	];
}

function selectChatExportMetadata(chat: Chat) {
	return { title: chat.title, createdAt: chat.createdAt, updatedAt: chat.updatedAt };
}

export type FeedbackVote = 'up' | 'down';

interface FeedbackCelebration {
	vote: FeedbackVote;
	key: number;
}

interface FeedbackDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (explanation?: string) => void;
	isPending: boolean;
	vote: FeedbackVote;
	subject?: string;
}

export function FeedbackDialog({
	open,
	onOpenChange,
	onSubmit,
	isPending,
	vote,
	subject = 'response',
}: FeedbackDialogProps) {
	const [explanation, setExplanation] = useState('');
	const isPositive = vote === 'up';

	const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		onSubmit(explanation.trim() || undefined);
		setExplanation('');
	};

	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) {
			setExplanation('');
		}
		onOpenChange(nextOpen);
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			e.currentTarget.form?.requestSubmit();
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent showCloseButton>
				<DialogHeader>
					<DialogTitle>{isPositive ? 'What went well?' : 'What went wrong?'}</DialogTitle>
					<DialogDescription className={styles.feedbackDialogDialogDescription}>
						{isPositive
							? `Help us improve by explaining what worked well with this ${subject}.`
							: `Help us improve by explaining what was wrong with this ${subject}.`}
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className={styles.feedbackDialogForm}>
					<Textarea
						placeholder={
							isPositive
								? 'Tell us what worked well (optional)'
								: 'Tell us what could be better (optional)'
						}
						value={explanation}
						onKeyDown={handleKeyDown}
						onChange={(e) => setExplanation(e.target.value)}
						rows={4}
						className={styles.feedbackDialogTextarea}
					/>

					<Button
						variant='primary-gradient'
						className={styles.feedbackDialogButton}
						type='submit'
						disabled={isPending}
					>
						Submit
					</Button>
				</form>
			</DialogContent>
		</Dialog>
	);
}
