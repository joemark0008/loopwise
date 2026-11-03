import { AlertCircleIcon, CheckIcon, CopyIcon, RotateCcwIcon } from 'lucide-react';
import styles from './chat-error.module.css';
import type { UIMessage } from '@quarry/api/agent/types/chat';
import { Button } from '@/components/ui/button';
import { useAgentContext, useAgentMessagesSelector } from '@/contexts/agent.provider';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { getLastUserMessageIdx } from '@/lib/ai';
import { cn } from '@/lib/utils';

export interface Props {
	className?: string;
}

type ParsedError = {
	error?: string;
	message?: string;
	requestId?: string;
};

function parseError(error: Error): ParsedError {
	try {
		const parsed = JSON.parse(error.message);
		const nested = parsed?.error;
		if (nested && typeof nested === 'object') {
			return {
				error: asString(nested.code) ?? asString(nested.type),
				message: asString(nested.message) ?? asString(parsed.message) ?? error.message,
				requestId: asString(nested.requestId),
			};
		}
		return {
			error: asString(nested),
			message: asString(parsed?.message),
		};
	} catch {
		return { message: error.message };
	}
}

function asString(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function ChatError({ className }: Props) {
	const { error, isRunning, resendMessage, clearError } = useAgentContext();
	const lastUserMessageId = useAgentMessagesSelector(findLastUserMessageId);
	const { isCopied, copy } = useCopyToClipboard();
	const parsed = error ? parseError(error) : null;

	if (!error) {
		return null;
	}

	const requestId = parsed?.requestId;
	const retry = async () => {
		if (!lastUserMessageId) {
			return;
		}

		clearError();
		await resendMessage({ messageId: lastUserMessageId });
	};

	return (
		<div className={cn(styles.chatErrorDiv, className)}>
			<AlertCircleIcon className={styles.chatErrorAlertCircleIcon} />

			<div className={styles.chatErrorDiv2}>
				{parsed?.error && <span className={styles.chatErrorSpan}>{parsed.error}</span>}
				{parsed?.message && <p className={`${styles.chatErrorP} mt`}>{parsed.message}</p>}
				{requestId && (
					<div className={styles.chatErrorDiv3}>
						<span>Provider request ID:</span>
						<code className={styles.chatErrorCode} title={requestId}>
							{requestId}
						</code>
						<Button
							variant='ghost'
							size='icon-sm'
							aria-label='Copy provider request ID'
							onClick={() => {
								void copy(requestId);
							}}
						>
							{isCopied ? <CheckIcon /> : <CopyIcon />}
						</Button>
					</div>
				)}
				{lastUserMessageId && (
					<Button
						variant='outline'
						size='sm'
						className={styles.chatErrorButton}
						disabled={isRunning}
						onClick={() => {
							void retry();
						}}
					>
						<RotateCcwIcon />
						Retry
					</Button>
				)}
			</div>
		</div>
	);
}

function findLastUserMessageId(messages: UIMessage[]): string | undefined {
	const lastUserMessageIndex = getLastUserMessageIdx(messages);
	return lastUserMessageIndex !== undefined ? messages[lastUserMessageIndex].id : undefined;
}
