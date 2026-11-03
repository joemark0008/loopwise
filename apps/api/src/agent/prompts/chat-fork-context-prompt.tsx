import { Block, Bold, Quote, Span, Title } from '../markdown/index.js';
import type { ForkMetadata } from '../types/chat.js';

const SELECTION_FORK_TYPES: ForkMetadata['type'][] = ['chat_selection', 'chat_question'];

type ChatForkContextPromptProps = {
	basePrompt: string;
	forkMetadata: ForkMetadata;
};

export function ChatForkContextPrompt({ basePrompt, forkMetadata }: ChatForkContextPromptProps) {
	if (SELECTION_FORK_TYPES.includes(forkMetadata.type) && forkMetadata.selectionText) {
		return (
			<Block>
				{basePrompt}
				<Title level={2}>Selection Context</Title>
				<Span>
					The user is asking about the following passage selected from <Bold>"{forkMetadata.title}"</Bold> by{' '}
					{forkMetadata.authorName}. Keep this selection as your primary focus when answering.
				</Span>
				<Quote>{forkMetadata.selectionText}</Quote>
			</Block>
		);
	}
	return <>{basePrompt}</>;
}
