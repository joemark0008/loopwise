import { memo, useMemo, useRef, useState } from 'react';
import { Pencil, Check, Copy, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Message } from 'prompt-mentions';
import { useQuery } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { ChatMessagesCitationChip } from './chat-messages-citation-chip';
import styles from './user-message.module.css';
import type { UIMessage } from '@loopwise/api/agent/types/chat';
import type { MessageMentionConfig, MentionOption, PromptTheme } from 'prompt-mentions';
import { cn } from '@/lib/utils';
import { useAgentContext } from '@/contexts/agent.provider';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useIsEditingMessage } from '@/hooks/use-is-editing-message-store';
import { useClickOutside } from '@/hooks/use-click-outside';
import { ChatInputInline } from '@/feature/chat/components/chat-input';
import { FileChip } from '@/feature/chat/components/file-chip';
import { ImageLightbox } from '@/feature/chat/components/image-lightbox';
import { getMessageText, getMessageImages, getMessageDocuments } from '@/lib/ai';
import { parseChatMessageCitation } from '@/lib/chat-messages-citation-parser';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { useTimeAgo } from '@/hooks/use-time-ago';
import { editedMessageIdStore } from '@/stores/chat-edited-message';
import { skillApi } from '@/lib/skill-api';
import DiscordIcon from '@/components/icons/discord.svg';
import MattermostIcon from '@/components/icons/mattermost.svg';
import SlackIcon from '@/components/icons/slack.svg';
import TeamsIcon from '@/components/icons/microsoft-teams.svg';
import McpIcon from '@/components/icons/model-context-protocol.svg';
import TelegramIcon from '@/components/icons/telegram.svg';
import WhatsAppIcon from '@/components/icons/whatsapp.svg';
import { useCurrentProject } from '@/hooks/use-current-project';

const messageTheme: PromptTheme = {
	backgroundColor: 'transparent',
	color: 'var(--app-text)',
	fontSize: '16px',
	fontFamily: 'inherit',
	borderColor: 'transparent',
	focusBorderColor: 'transparent',
	focusBoxShadow: 'none',
	padding: '0',
	minHeight: 'auto',
	pill: {
		backgroundColor: 'var(--app-surface)',
		color: 'var(--app-text)',
		padding: 'calc(var(--spacing) * 1) calc(var(--spacing) * 2.5)',
		borderRadius: '9999px',
	},
};

const MESSAGE_SOURCES = {
	slack: { icon: <SlackIcon className={styles.mESSAGESOURCESSlackIcon} />, label: 'sent in Slack' },
	teams: { icon: <TeamsIcon className={styles.mESSAGESOURCESTeamsIcon} />, label: 'sent in Teams' },
	telegram: { icon: <TelegramIcon className={styles.mESSAGESOURCESTeamsIcon} />, label: 'sent in Telegram' },
	mattermost: { icon: <MattermostIcon className={styles.mESSAGESOURCESTeamsIcon} />, label: 'sent in Mattermost' },
	discord: { icon: <DiscordIcon className={styles.mESSAGESOURCESTeamsIcon} />, label: 'sent in Discord' },
	whatsapp: { icon: <WhatsAppIcon className={styles.mESSAGESOURCESTeamsIcon} />, label: 'sent in WhatsApp' },
	mcp: { icon: <McpIcon className={styles.mESSAGESOURCESTeamsIcon} />, label: 'sent via MCP' },
} as const;

function MessageSourceBadge({ source }: { source: UIMessage['source'] }) {
	const config = source ? MESSAGE_SOURCES[source as keyof typeof MESSAGE_SOURCES] : null;
	if (!config) {
		return null;
	}

	return (
		<span className={styles.messageSourceBadgeSpan}>
			{config.icon}
			{config.label}
		</span>
	);
}

function useMentionConfigs(): MessageMentionConfig[] {
	const project = useCurrentProject();
	const hasProject = project.data != null;
	const skillsQuery = useQuery({ ...skillApi.skill.list.queryOptions(), enabled: hasProject });
	const skills = hasProject ? skillsQuery.data : undefined;

	return useMemo(() => {
		const skillOptions: MentionOption[] = (skills ?? []).map((skill) => ({
			id: skill.name,
			label: skill.name,
		}));

		return [{ trigger: '/', options: skillOptions, showTrigger: true }];
	}, [skills]);
}

export const UserMessageBubble = memo(({ message }: { message: UIMessage }) => {
	const rawText = useMemo(() => getMessageText(message), [message]);
	const images = useMemo(() => getMessageImages(message), [message]);
	const documents = useMemo(() => getMessageDocuments(message), [message]);
	const mentionConfigs = useMentionConfigs();
	const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

	const legacyCitation = useMemo(() => parseChatMessageCitation(rawText), [rawText]);
	const citation = message.citation ?? legacyCitation;
	const displayText = legacyCitation ? legacyCitation.question : rawText;

	return (
		<div className={styles.userMessageBubbleDiv}>
			<MessageSourceBadge source={message.source} />
			{citation && <ChatMessagesCitationChip start={citation.start} end={citation.end} text={citation.text} />}
			{images.length > 0 && (
				<div className={styles.userMessageBubbleDiv2}>
					{images.map((img, idx) => (
						<button
							key={idx}
							type='button'
							onClick={() => setLightboxSrc(img.url)}
							className={styles.userMessageBubbleButton}
						>
							<img src={img.url} alt='' className={styles.userMessageBubbleImg} />
						</button>
					))}
				</div>
			)}
			{documents.length > 0 && (
				<div className={styles.userMessageBubbleDiv3}>
					{documents.map((document) => (
						<FileChip key={document.path} path={document.path} label={document.filename} />
					))}
				</div>
			)}
			{displayText && (
				<Message
					value={displayText}
					mentionConfigs={mentionConfigs}
					theme={messageTheme}
					className={styles.userMessageBubbleMessage}
				/>
			)}
			{lightboxSrc &&
				createPortal(<ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />, document.body)}
		</div>
	);
});

export const UserMessage = memo(({ message }: { message: UIMessage }) => {
	const { isRunning, editMessage, resendMessage, switchMessageVersion } = useAgentContext();
	const { isCopied, copy } = useCopyToClipboard();
	const isEditing = useIsEditingMessage(message.id);
	const editContainerRef = useRef<HTMLDivElement>(null);
	const text = useMemo(() => getMessageText(message), [message]);

	useClickOutside(
		{
			containerRef: editContainerRef,
			enabled: isEditing,
			onClickOutside: () => editedMessageIdStore.setEditingId(undefined),
		},
		[isEditing],
	);

	if (isEditing) {
		return (
			<div ref={editContainerRef}>
				<ChatInputInline
					initialText={text}
					className={styles.userMessageChatInputInline}
					onCancel={() => editedMessageIdStore.setEditingId(undefined)}
					onSubmitMessage={async ({ text: nextText, images, documents }) => {
						editedMessageIdStore.setEditingId(undefined);
						await editMessage({ messageId: message.id, text: nextText, images, documents });
					}}
				/>
			</div>
		);
	}

	return (
		<div className={`${styles.userMessageDiv} group`}>
			<UserMessageBubble message={message} />

			<div className={styles.userMessageDiv2}>
				<div className={cn(styles.userMessageDiv3, isRunning && styles.userMessageDiv4)}>
					{message.createdAt && <MessageTimestamp createdAt={message.createdAt} />}
					<SimpleTooltip content='Resend'>
						<Button
							variant='ghost-muted'
							size='icon-sm'
							className={styles.userMessageButton}
							aria-label='Resend'
							disabled={isRunning}
							onClick={() => resendMessage({ messageId: message.id })}
						>
							<RotateCcw />
						</Button>
					</SimpleTooltip>
					<SimpleTooltip content='Edit'>
						<Button
							variant='ghost-muted'
							size='icon-sm'
							className={styles.userMessageButton}
							aria-label='Edit'
							onClick={() => editedMessageIdStore.setEditingId(message.id)}
						>
							<Pencil />
						</Button>
					</SimpleTooltip>
					<SimpleTooltip content='Copy'>
						<Button
							variant='ghost-muted'
							size='icon-sm'
							className={styles.userMessageButton}
							aria-label='Copy'
							onClick={() => copy(getMessageText(message))}
						>
							{isCopied ? <Check className={styles.mESSAGESOURCESTeamsIcon} /> : <Copy />}
						</Button>
					</SimpleTooltip>
				</div>

				{message.versionInfo && message.versionInfo.totalVersions > 1 && (
					<MessageVersionNav
						versionInfo={message.versionInfo}
						disabled={isRunning}
						onSwitch={(messageId) => switchMessageVersion({ messageId })}
					/>
				)}
			</div>
		</div>
	);
});

function MessageTimestamp({ createdAt }: { createdAt: number }) {
	const { humanReadable } = useTimeAgo(createdAt);
	return (
		<SimpleTooltip content={new Date(createdAt).toLocaleString()}>
			<span className={styles.messageTimestampSpan}>{humanReadable}</span>
		</SimpleTooltip>
	);
}

function MessageVersionNav({
	versionInfo,
	disabled,
	onSwitch,
}: {
	versionInfo: NonNullable<UIMessage['versionInfo']>;
	disabled: boolean;
	onSwitch: (messageId: string) => void;
}) {
	const { currentVersion, totalVersions, versionIds } = versionInfo;
	const goToPrevious = () => onSwitch(versionIds[currentVersion - 2]);
	const goToNext = () => onSwitch(versionIds[currentVersion]);

	return (
		<div className={styles.messageVersionNavDiv}>
			<Button
				variant='ghost-muted'
				size='icon-sm'
				className={styles.messageVersionNavButton}
				aria-label='Previous version'
				disabled={disabled || currentVersion <= 1}
				onClick={goToPrevious}
			>
				<ChevronLeft />
			</Button>
			<span className={styles.messageVersionNavSpan}>
				{currentVersion}/{totalVersions}
			</span>
			<Button
				variant='ghost-muted'
				size='icon-sm'
				className={styles.messageVersionNavButton}
				aria-label='Next version'
				disabled={disabled || currentVersion >= totalVersions}
				onClick={goToNext}
			>
				<ChevronRight />
			</Button>
		</div>
	);
}
