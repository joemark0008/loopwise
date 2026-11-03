import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowUp, ChevronDown, ChevronUp, Loader2, Maximize2, MessageCircle, X } from 'lucide-react';
import { ChatInputAnimatedBorder } from './chat-input-animated-border';
import { SelectionCitationExcerpt } from './selection-citation-excerpt';
import styles from './ask-bar.module.css';
import type { FormEvent, ReactNode, RefObject } from 'react';
import type { UIMessage } from '@quarry/api/agent/types/chat';

import type { AskQuestion, AskSelection } from '@/stores/ask-bar';
import { ChatMessagesContent } from '@/feature/chat/components/chat-messages/chat-messages';
import { Button } from '@/components/ui/button';
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ui/conversation';
import { TextShimmer } from '@/components/ui/text-shimmer';
import { AgentProvider, useAgentContext, useAgentMessages } from '@/contexts/agent.provider';
import { SetChatInputCallbackProvider, useRegisterSetChatInputCallback } from '@/contexts/set-chat-input-callback';
import { ChatIdContext, useChatId } from '@/hooks/use-chat-id';
import { cn } from '@/lib/utils';
import { useAskRequest } from '@/stores/ask-bar';

type AskSession = {
	chatId: string | null;
	selection?: AskSelection;
	pendingText?: string;
	isPanelOpen: boolean;
};

const NO_SESSION: AskSession = { chatId: null, isPanelOpen: false };
const ASK_ERROR_MESSAGE = "Couldn't ask this question. Try again.";

/**
 * A floating input at the bottom of the page: asking opens the conversation in a panel beside the content;
 * folded, the panel becomes a pill above the input. The page decides how the chat of a question is created.
 */
export function AskBar({
	placeholder,
	isInputHidden = false,
	isAsking,
	hasAskFailed,
	resumedQuestion,
	onAsk,
	onEnd,
	children,
}: {
	placeholder: string;
	isInputHidden?: boolean;
	isAsking: boolean;
	hasAskFailed: boolean;
	/** A question to reopen with its panel open as the bar mounts. */
	resumedQuestion?: AskQuestion;
	/** Creates the chat of a new question and returns its id. */
	onAsk: (selection?: AskSelection) => Promise<string>;
	onEnd?: () => void;
	/** Rendered within the agent of the question, to react to its answers. */
	children?: ReactNode;
}) {
	const [session, setSession] = useState<AskSession>(() =>
		resumedQuestion ? { ...resumedQuestion, isPanelOpen: true } : NO_SESSION,
	);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const request = useAskRequest();
	const requestIdAtMount = useRef(request?.id);

	useEffect(() => {
		if (!request || request.id === requestIdAtMount.current) {
			return;
		}
		if (request.chatId || request.selection) {
			setSession({ chatId: request.chatId, selection: request.selection, isPanelOpen: !!request.chatId });
		}
		inputRef.current?.focus();
	}, [request]);

	const startSession = async (text: string) => {
		const chatId = await onAsk(session.selection);
		setSession((current) => ({ ...current, chatId, pendingText: text, isPanelOpen: true }));
	};
	const setPanelOpen = (isPanelOpen: boolean) => setSession((current) => ({ ...current, isPanelOpen }));
	const endSession = () => {
		onEnd?.();
		setSession(NO_SESSION);
	};

	if (!session.chatId) {
		return (
			<FloatingBar isHidden={isInputHidden}>
				<AskInput
					inputRef={inputRef}
					placeholder={placeholder}
					selection={session.selection}
					isSending={isAsking}
					error={hasAskFailed ? ASK_ERROR_MESSAGE : undefined}
					onClearSelection={endSession}
					onSubmit={startSession}
				/>
			</FloatingBar>
		);
	}

	return (
		<ChatIdContext.Provider value={session.chatId}>
			<SetChatInputCallbackProvider>
				<AgentProvider disableNavigation>
					<PendingMessageSender
						pendingText={session.pendingText}
						onSent={() => setSession((current) => ({ ...current, pendingText: undefined }))}
					/>
					{children}
					{session.isPanelOpen ? (
						<AskPanel
							placeholder={placeholder}
							selection={session.selection}
							onCollapse={() => setPanelOpen(false)}
							onClose={endSession}
						/>
					) : (
						<FloatingBar isHidden={isInputHidden}>
							<AskStatus onOpen={() => setPanelOpen(true)} onClose={endSession} />
							<SessionInput inputRef={inputRef} placeholder={placeholder} />
						</FloatingBar>
					)}
				</AgentProvider>
			</SetChatInputCallbackProvider>
		</ChatIdContext.Provider>
	);
}

function FloatingBar({ isHidden, children }: { isHidden: boolean; children: ReactNode }) {
	return (
		<div data-selection-ignore className={cn(styles.floatingBarDiv, isHidden && styles.floatingBarDiv2)}>
			<div className={styles.floatingBarDiv3}>{children}</div>
		</div>
	);
}

/** Sends the first message once the new quick question is mounted. */
function PendingMessageSender({ pendingText, onSent }: { pendingText?: string; onSent: () => void }) {
	const { queueOrSendMessage } = useAgentContext();
	const sentText = useRef<string | null>(null);

	useEffect(() => {
		if (!pendingText || sentText.current === pendingText) {
			return;
		}
		sentText.current = pendingText;
		onSent();
		void queueOrSendMessage({ text: pendingText });
	}, [pendingText, onSent, queueOrSendMessage]);

	return null;
}

/** The folded panel: the agent at work, then the answers ready to read, as a pill above the input. */
function AskStatus({ onOpen, onClose }: { onOpen: () => void; onClose: () => void }) {
	const messages = useAgentMessages();
	const { isRunning } = useAgentContext();
	const questionCount = countQuestions(messages);
	if (questionCount === 0) {
		return null;
	}

	return (
		<div className={styles.askStatusDiv}>
			<button type='button' onClick={onOpen} className={styles.askStatusButton}>
				{isRunning ? (
					<TextShimmer showLogo />
				) : (
					<>
						<MessageCircle className={styles.askStatusMessageCircle} strokeWidth={2.25} />
						<span>{questionCount === 1 ? 'Answer ready · Show' : `${questionCount} answers · Show`}</span>
						<ChevronUp className={styles.askStatusChevronUp} strokeWidth={2.25} />
					</>
				)}
			</button>
			<Button
				variant='ghost'
				size='icon-xs'
				className={styles.askStatusButton2}
				onClick={onClose}
				aria-label='End this question'
			>
				<X />
			</Button>
		</div>
	);
}

function SessionInput({
	inputRef,
	placeholder,
}: {
	inputRef: RefObject<HTMLTextAreaElement | null>;
	placeholder: string;
}) {
	const { queueOrSendMessage, isRunning } = useAgentContext();
	return (
		<AskInput
			inputRef={inputRef}
			placeholder={placeholder}
			isSending={isRunning}
			onSubmit={(text) => void queueOrSendMessage({ text })}
		/>
	);
}

/** The whole quick question beside the content, rendered like any chat, with its own input. */
function AskPanel({
	placeholder,
	selection,
	onCollapse,
	onClose,
}: {
	placeholder: string;
	selection?: AskSelection;
	onCollapse: () => void;
	onClose: () => void;
}) {
	const panelInputRef = useRef<HTMLTextAreaElement>(null);
	const { queueOrSendMessage, isRunning } = useAgentContext();

	useEffect(() => {
		panelInputRef.current?.focus();
	}, []);

	return (
		<AskPanelFrame selection={selection} onCollapse={onCollapse} onClose={onClose}>
			<Conversation className={styles.askPanelConversation}>
				<ConversationContent className={styles.askPanelConversationContent}>
					<ChatMessagesContent />
				</ConversationContent>
				<ConversationScrollButton />
			</Conversation>
			<div className={styles.askPanelDiv}>
				<AskInput
					inputRef={panelInputRef}
					placeholder={placeholder}
					isSending={isRunning}
					fillsFromFollowUps
					onSubmit={(text) => void queueOrSendMessage({ text })}
				/>
			</div>
		</AskPanelFrame>
	);
}

/** The panel beside the content, headed by its controls and the part of the page the question is about. */
function AskPanelFrame({
	selection,
	onCollapse,
	onClose,
	children,
}: {
	selection?: AskSelection;
	onCollapse?: () => void;
	onClose: () => void;
	children: ReactNode;
}) {
	return (
		<aside data-selection-ignore className={styles.askPanelFrameAside}>
			<AskPanelHeader onCollapse={onCollapse} onClose={onClose} />
			{selection && (
				<div className={styles.askPanelFrameDiv}>
					<SelectionCard selection={selection} />
				</div>
			)}
			{children}
		</aside>
	);
}

/** Lets the user read the quick question as a full chat, fold it back into the pill, or end it. */
function AskPanelHeader({ onCollapse, onClose }: { onCollapse?: () => void; onClose: () => void }) {
	const chatId = useChatId();
	const navigate = useNavigate();

	return (
		<div className={styles.askPanelHeaderDiv}>
			<MessageCircle className={styles.askPanelHeaderMessageCircle} strokeWidth={2.25} />
			<span className={styles.askPanelHeaderSpan}>Quick question</span>
			<div className={styles.askPanelHeaderDiv2}>
				{chatId && (
					<Button
						variant='ghost'
						size='icon-xs'
						className={styles.askStatusButton2}
						onClick={() => navigate({ to: '/$chatId', params: { chatId } })}
						aria-label='Open as a chat'
					>
						<Maximize2 />
					</Button>
				)}
				{onCollapse && (
					<Button
						variant='ghost'
						size='icon-xs'
						className={styles.askStatusButton2}
						onClick={onCollapse}
						aria-label='Fold the answers'
					>
						<ChevronDown />
					</Button>
				)}
				<Button
					variant='ghost'
					size='icon-xs'
					className={styles.askStatusButton2}
					onClick={onClose}
					aria-label='End this question'
				>
					<X />
				</Button>
			</div>
		</div>
	);
}

export function AskInput({
	inputRef,
	placeholder,
	selection,
	isSending,
	fillsFromFollowUps = false,
	error,
	onClearSelection,
	onSubmit,
}: {
	inputRef: RefObject<HTMLTextAreaElement | null>;
	placeholder: string;
	selection?: AskSelection;
	isSending: boolean;
	/** Follow-up suggestions of the conversation fill the input, as they do in a chat. */
	fillsFromFollowUps?: boolean;
	error?: string;
	onClearSelection?: () => void;
	/** The input keeps the text when the submit fails, so the question can be sent again. */
	onSubmit: (text: string) => void | Promise<void>;
}) {
	const [text, setText] = useState('');

	const submit = (event?: FormEvent) => {
		event?.preventDefault();
		const trimmed = text.trim();
		if (!trimmed || isSending) {
			return;
		}
		Promise.resolve(onSubmit(trimmed))
			.then(() => setText(''))
			.catch(() => undefined);
	};

	return (
		<form
			onSubmit={submit}
			className={cn(styles.askInputForm, selection ? styles.askInputForm2 : styles.askStatusButton2)}
		>
			<ChatInputAnimatedBorder isStatic />
			{fillsFromFollowUps && <FollowUpFiller onFill={setText} />}
			{selection && <SelectionCard selection={selection} onClear={onClearSelection} />}
			<div className={styles.askInputDiv}>
				<textarea
					ref={inputRef}
					value={text}
					rows={1}
					placeholder={placeholder}
					onChange={(event) => setText(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === 'Enter' && !event.shiftKey) {
							submit(event);
						}
					}}
					className={styles.askInputTextarea}
				/>
				<Button
					type='submit'
					size='icon-sm'
					className={cn(styles.askInputButton, !text.trim() && styles.askInputButton2)}
					disabled={!text.trim() || isSending}
					aria-label='Send'
				>
					{isSending ? <Loader2 className={styles.askInputLoader2} /> : <ArrowUp />}
				</Button>
			</div>
			{error && (
				<p role='alert' className={styles.askInputP}>
					{error}
				</p>
			)}
		</form>
	);
}

/** The part of the page the question is about, quoted like a selection asked about in a chat. */
function SelectionCard({ selection, onClear }: { selection: AskSelection; onClear?: () => void }) {
	return (
		<div className={styles.selectionCardDiv}>
			<SelectionCitationExcerpt
				text={selection.text}
				start={selection.start}
				end={selection.end}
				block={selection.block}
			/>
			{onClear && (
				<Button
					type='button'
					variant='ghost'
					size='icon-xs'
					className={styles.selectionCardButton}
					onClick={onClear}
					aria-label='Remove the selection'
				>
					<X />
				</Button>
			)}
		</div>
	);
}

function FollowUpFiller({ onFill }: { onFill: (text: string) => void }) {
	useRegisterSetChatInputCallback(onFill);
	return null;
}

/** Messages carried over from another chat are left out: the user never wrote them here. */
function countQuestions(messages: UIMessage[]): number {
	return messages.filter((message) => message.role === 'user' && !message.isForked).length;
}
