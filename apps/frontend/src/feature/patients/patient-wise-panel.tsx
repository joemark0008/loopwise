import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import styles from './patient-chart.module.css';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { AgentProvider, useAgentContext, useAgentMessages } from '@/contexts/agent.provider';
import { SetChatInputCallbackProvider } from '@/contexts/set-chat-input-callback';
import { ChatInput } from '@/feature/chat/components/chat-input';
import { ChatMessages } from '@/feature/chat/components/chat-messages/chat-messages';
import { ChatIdContext } from '@/hooks/use-chat-id';
import { patientApi } from '@/lib/patient-api';

const SUGGESTIONS = ['Summarise this patient', 'Start an encounter for today'];

/**
 * The patient's chart chat with Wise: one per clinician per patient, so it resumes where it was left. Wise is told
 * about the patient on every message, and drafts encounters from it.
 */
export function PatientWisePanel({ patientId, actions }: { patientId: string; actions?: ReactNode }) {
	// Read once per visit: the agent keeps track of a chat it creates, so the id given to it must not change mid-chat.
	const chat = useQuery({
		...patientApi.patient.chat.queryOptions({ patientId }),
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		gcTime: 0,
	});

	return (
		<section className={styles.wisePanel} aria-label='Ask Wise'>
			<header className={styles.wiseHeader}>
				<Sparkles />
				<span>Ask Wise about this patient</span>
				{actions && <div className={styles.wiseHeaderActions}>{actions}</div>}
			</header>
			{chat.isPending ? (
				<Skeleton className={styles.chartSkeleton} />
			) : chat.error ? (
				<ErrorMessage message={chat.error.message} />
			) : (
				<ChatIdContext.Provider value={chat.data ?? undefined}>
					<SetChatInputCallbackProvider>
						<AgentProvider disableNavigation patientId={patientId}>
							<WiseConversation
								intro='Wise knows this patient’s record and recent visits. Describe a visit and it drafts the encounter for you to confirm.'
								suggestions={SUGGESTIONS}
							/>
						</AgentProvider>
					</SetChatInputCallbackProvider>
				</ChatIdContext.Provider>
			)}
		</section>
	);
}

/** A Wise chat in a panel: its messages (or an intro with suggestions), errors and the input. */
export function WiseConversation({ intro, suggestions }: { intro: string; suggestions: string[] }) {
	const messages = useAgentMessages();
	const { queueOrSendMessage, isLoadingMessages, error } = useAgentContext();

	return (
		<div className={styles.wiseConversation}>
			<div className={styles.wiseMessages}>
				{messages.length === 0 && !isLoadingMessages ? (
					<div className={styles.wiseEmpty}>
						<p>{intro}</p>
						<div className={styles.wiseSuggestions}>
							{suggestions.map((text) => (
								<Button
									key={text}
									variant='outline'
									size='sm'
									onClick={() => void queueOrSendMessage({ text })}
								>
									{text}
								</Button>
							))}
						</div>
					</div>
				) : (
					<ChatMessages />
				)}
			</div>
			{error && <ErrorMessage message={error.message} />}
			<div className={styles.wiseInput}>
				<ChatInput />
			</div>
		</div>
	);
}
