import { useQuery } from '@tanstack/react-query';
import styles from './chat-input-context-window-ring.module.css';
import type { UIMessage } from '@loopwise/api/agent/types/chat';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useChatId } from '@/hooks/use-chat-id';
import { useAgentContext, useAgentMessagesSelector } from '@/contexts/agent.provider';
import { chatApi } from '@/lib/chat-api';

const RADIUS = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function clampPercent(percent: number): number {
	return Math.max(0, Math.min(100, percent));
}

function formatTokens(n: number): string {
	if (n >= 1_000_000) {
		return `${(n / 1_000_000).toFixed(1)}M`;
	}
	if (n >= 1_000) {
		return `${(n / 1_000).toFixed(1)}K`;
	}
	return String(n);
}

function buildTooltipText({
	percent,
	tokensUsed,
	contextWindow,
}: {
	percent: number;
	tokensUsed: number;
	contextWindow: number;
}): string {
	const percentLabel = percent.toFixed(1);
	return `${percentLabel}% · ${formatTokens(tokensUsed)}/${formatTokens(contextWindow)} context used`;
}

function ringColor(value: number): string {
	if (value >= 85) {
		return styles.ringColor;
	}
	if (value >= 65) {
		return styles.ringColor2;
	}
	return styles.ringColor3;
}

export function ContextWindowRingView({
	tokensUsed,
	contextWindow,
	className,
}: {
	tokensUsed: number;
	contextWindow: number;
	className?: string;
}) {
	const percentRaw = tokensUsed > 0 ? (tokensUsed / contextWindow) * 100 : 0;
	const percent = tokensUsed > 0 ? Math.min(100, Math.max(0.1, parseFloat(percentRaw.toFixed(1)))) : 0;
	const clamped = clampPercent(percent);
	const offset = CIRCUMFERENCE * (1 - clamped / 100);
	const tooltipText = buildTooltipText({ percent: clamped, tokensUsed, contextWindow });

	return (
		<Tooltip delayDuration={200}>
			<TooltipTrigger asChild>
				<span tabIndex={0} aria-label={tooltipText} className={styles.contextWindowRingViewSpan}>
					<svg
						width='20'
						height='20'
						viewBox='0 0 20 20'
						className={cn(styles.contextWindowRingViewSvg, className)}
						aria-hidden='true'
					>
						<circle
							cx='10'
							cy='10'
							r={RADIUS}
							fill='none'
							strokeWidth='2.5'
							className={styles.contextWindowRingViewCircle}
						/>
						<circle
							cx='10'
							cy='10'
							r={RADIUS}
							fill='none'
							strokeWidth='2.5'
							strokeLinecap='round'
							strokeDasharray={CIRCUMFERENCE}
							strokeDashoffset={offset}
							className={cn(styles.contextWindowRingViewCircle2, ringColor(clamped))}
						/>
					</svg>
				</span>
			</TooltipTrigger>
			<TooltipContent side='top' align='center'>
				{tooltipText}
			</TooltipContent>
		</Tooltip>
	);
}

export function ContextWindowRing({ className }: { className?: string }) {
	const chatId = useChatId();
	const { selectedModel, isRunning } = useAgentContext();
	const hasAssistantMessage = useAgentMessagesSelector(hasSomeAssistantMessage);

	const contextUsage = useQuery(
		chatApi.chat.getContextUsage.queryOptions(
			{
				chatId: chatId ?? '',
				model: selectedModel ? { provider: selectedModel.provider, modelId: selectedModel.modelId } : undefined,
			},
			{
				enabled: !!chatId && !isRunning && hasAssistantMessage && !!selectedModel,
				staleTime: 0,
				refetchOnWindowFocus: false,
			},
		),
	);

	if (!hasAssistantMessage || contextUsage.data?.contextWindow == null) {
		return null;
	}

	return (
		<ContextWindowRingView
			tokensUsed={contextUsage.data.tokensUsed}
			contextWindow={contextUsage.data.contextWindow}
			className={className}
		/>
	);
}

function hasSomeAssistantMessage(messages: UIMessage[]): boolean {
	return messages.some((message) => message.role === 'assistant');
}
