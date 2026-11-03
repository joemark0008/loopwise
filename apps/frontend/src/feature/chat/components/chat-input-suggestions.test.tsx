// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatInputSuggestions } from './chat-input-suggestions';

const mocks = vi.hoisted(() => ({
	messages: [] as unknown[],
	queueOrSendMessage: vi.fn(),
	submitFeedback: vi.fn(),
	inactivityDelays: [] as number[],
	mode: 'default' as 'default' | 'onboarding',
}));

vi.mock('@/contexts/agent.provider', () => ({
	useAgentContext: () => ({
		isReadonly: false,
		isRunning: false,
		queueOrSendMessage: mocks.queueOrSendMessage,
		mode: mocks.mode,
	}),
	useAgentMessagesSelector: (selector: (messages: unknown[]) => unknown) => selector(mocks.messages),
	useAgentMessagesGetter: () => () => mocks.messages,
}));
vi.mock('@/hooks/use-chat-id', () => ({ useChatId: () => 'chat-1' }));
vi.mock('@/hooks/use-inactivity-trigger', () => ({
	useInactivityTrigger: ({ delayMs }: { delayMs: number }) => {
		mocks.inactivityDelays.push(delayMs);
		return true;
	},
}));
vi.mock('@/lib/ai', () => ({
	checkAssistantMessageHasContent: () => true,
	NEW_CHAT_ID: 'new',
}));
vi.mock('@/feature/chat/components/chat-messages/assistant-message-actions', () => ({
	FeedbackDialog: () => null,
	NegativeFeedbackDialog: () => null,
}));
vi.mock('@tanstack/react-query', () => ({
	useMutation: () => ({ isPending: false, mutate: mocks.submitFeedback }),
}));
vi.mock('@/test/procedures', () => ({
	procedures: {
		feedback: { submit: { mutationOptions: vi.fn() } },
		chat: { get: { queryKey: vi.fn() } },
	},
}));

beforeEach(() => {
	localStorage.clear();
	mocks.inactivityDelays = [];
	mocks.mode = 'default';
	mocks.messages = [{ id: 'assistant-1', role: 'assistant', parts: [{ type: 'text', text: 'Result' }] }];
	const observerCallbacks = new Map<ResizeObserver, ResizeObserverCallback>();
	globalThis.ResizeObserver = class {
		constructor(callback: ResizeObserverCallback) {
			observerCallbacks.set(this, callback);
		}
		observe() {
			observerCallbacks.get(this)?.([], this);
		}
		unobserve() {}
		disconnect() {
			observerCallbacks.delete(this);
		}
		takeRecords() {
			return [];
		}
	};
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe('ChatInputSuggestions', () => {
	it('shows conversation feedback', () => {
		render(<ChatInputSuggestions />);

		expect(screen.getByText('How did this conversation go?')).toBeTruthy();
	});

	it('does not show conversation feedback for onboarding chats', () => {
		mocks.mode = 'onboarding';

		render(<ChatInputSuggestions />);

		expect(screen.queryByText('How did this conversation go?')).toBeNull();
	});

	it('shows MCP authentication suggestions', () => {
		mocks.messages = [
			{
				id: 'assistant-1',
				role: 'assistant',
				parts: [
					{
						type: 'dynamic-tool',
						output: { mcpAuthRequired: true, server: 'salesforce' },
					},
				],
			},
		];

		render(<ChatInputSuggestions />);

		expect(screen.getByText('Connect your account to "salesforce" to continue')).toBeTruthy();
	});

	it('makes a collapsed suggestion inert', () => {
		const { container, rerender } = render(<ChatInputSuggestions />);
		const panel = container.firstElementChild;

		expect(panel?.hasAttribute('inert')).toBe(false);

		rerender(<ChatInputSuggestions isHidden />);

		expect(panel?.hasAttribute('inert')).toBe(true);
	});

	describe('conversation feedback dismissal', () => {
		it('hides the prompt for the chat and pushes the next prompt further out', () => {
			render(<ChatInputSuggestions />);
			expect(mocks.inactivityDelays.at(-1)).toBe(10_000);

			fireEvent.click(screen.getByLabelText('Dismiss'));

			expect(screen.queryByText('How did this conversation go?')).toBeNull();
			expect(mocks.inactivityDelays.at(-1)).toBe(15_000);
			expect(JSON.parse(localStorage.getItem('loopwise-feedback-prompt-dismiss-count') ?? '0')).toBe(1);
			expect(JSON.parse(localStorage.getItem('loopwise-feedback-prompt-dismissed-chats') ?? '[]')).toEqual([
				'chat-1',
			]);
		});

		it('never shows the prompt again for a chat dismissed in a previous session', () => {
			localStorage.setItem('loopwise-feedback-prompt-dismissed-chats', JSON.stringify(['chat-1']));

			render(<ChatInputSuggestions />);

			expect(screen.queryByText('How did this conversation go?')).toBeNull();
		});

		it('keeps escalating the delay across sessions and caps it', () => {
			localStorage.setItem('loopwise-feedback-prompt-dismiss-count', JSON.stringify(2));
			const { unmount } = render(<ChatInputSuggestions />);
			expect(mocks.inactivityDelays.at(-1)).toBe(25_000);
			unmount();

			localStorage.setItem('loopwise-feedback-prompt-dismiss-count', JSON.stringify(50));
			render(<ChatInputSuggestions />);
			expect(mocks.inactivityDelays.at(-1)).toBe(60_000);
		});
	});
});
