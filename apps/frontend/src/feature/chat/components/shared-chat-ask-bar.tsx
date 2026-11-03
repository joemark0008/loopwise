import { useMutation, useQueryClient } from '@tanstack/react-query';

import { AskBar } from './ask-bar';
import type { AskSelection } from '@/stores/ask-bar';
import { chatApi } from '@/lib/chat-api';

/** Asks about a shared chat: each question is a fork of it, so the agent answers knowing the whole conversation. */
export function SharedChatAskBar({ shareId }: { shareId: string }) {
	const queryClient = useQueryClient();
	const askMutation = useMutation(
		chatApi.chatFork.askSharedChat.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries({
					queryKey: chatApi.chatFork.listSharedChatQuickQuestions.queryKey({ shareId }),
				}),
		}),
	);

	const askSharedChat = async (selection?: AskSelection) => {
		const { chatId } = await askMutation.mutateAsync({ shareId, selection: toForkSelection(selection) });
		return chatId;
	};

	return (
		<AskBar
			placeholder='Ask a question about this chat'
			isAsking={askMutation.isPending}
			hasAskFailed={askMutation.isError}
			onAsk={askSharedChat}
		/>
	);
}

function toForkSelection(selection?: AskSelection) {
	if (!selection || selection.start === undefined || selection.end === undefined) {
		return undefined;
	}
	return { start: selection.start, end: selection.end, text: selection.text };
}
