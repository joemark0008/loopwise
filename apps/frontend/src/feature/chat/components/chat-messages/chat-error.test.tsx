// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { ChatError } from './chat-error';

const mocks = vi.hoisted(() => ({
	clearError: vi.fn(),
	copy: vi.fn(),
	error: null as Error | null,
	resendMessage: vi.fn(async () => undefined),
}));

vi.mock('@/contexts/agent.provider', () => ({
	useAgentContext: () => ({
		clearError: mocks.clearError,
		error: mocks.error,
		isRunning: false,
		resendMessage: mocks.resendMessage,
	}),
	useAgentMessagesSelector: (selector: (messages: unknown[]) => unknown) =>
		selector([{ id: 'message-id', role: 'user' }]),
}));

vi.mock('@/hooks/use-copy-to-clipboard', () => ({
	useCopyToClipboard: () => ({ copy: mocks.copy, isCopied: false }),
}));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

it('shows parsed provider details for an error', () => {
	mocks.error = new Error(
		JSON.stringify({
			error: {
				code: 'provider_error',
				message: 'Provider request failed.',
				requestId: 'request-id',
			},
		}),
	);

	render(<ChatError />);

	expect(screen.getByText('provider_error')).toBeTruthy();
	expect(screen.getByText('Provider request failed.')).toBeTruthy();
	expect(screen.getByText('request-id')).toBeTruthy();

	fireEvent.click(screen.getByRole('button', { name: 'Copy provider request ID' }));
	expect(mocks.copy).toHaveBeenCalledWith('request-id');
});

it('retries the last user message', async () => {
	mocks.error = new Error('Something failed.');

	render(<ChatError />);
	fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

	await waitFor(() => expect(mocks.resendMessage).toHaveBeenCalledWith({ messageId: 'message-id' }));
	expect(mocks.clearError).toHaveBeenCalled();
});
