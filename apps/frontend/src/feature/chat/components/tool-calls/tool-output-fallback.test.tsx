// @vitest-environment jsdom

/**
 * A tool call with no output must not look the same when it is running and when its output is
 * never going to arrive. loopwise's SQL/Python bodies rendered the in-flight placeholder for
 * both, so a dropped stream showed "Executing query..." forever and the only way out was a
 * manual reload — see the header comment in `tool-output-fallback.tsx`.

 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ToolOutputFallback } from './tool-output-fallback';
import type { ToolCallComponentProps } from '.';
import { ToolCallProvider } from '@/contexts/tool-call';

vi.mock('@/contexts/side-panel', () => ({
	useSidePanel: () => ({ open: vi.fn(), currentStorySlug: null, isVisible: false }),
}));

// `TableDisplay` reaches `@/hooks/use-date-format`, which imports `@/main` and would execute the
// real app bootstrap (it mounts on a `#app` element that does not exist under jsdom).
vi.mock('@/hooks/use-date-format', () => ({
	useDateFormat: () => ({ preset: 'european' }),
}));
// The SQL body offers "Save as query tool", which reads the clinic role and navigates to settings.
vi.mock('@/hooks/use-permissions', () => ({ usePermissions: () => ({ canSendMessages: true }) }));
vi.mock('@tanstack/react-router', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	useNavigate: () => vi.fn(),
}));
vi.mock('@/test/procedures', () => ({
	procedures: {
		analyticsEvent: { logChatDownload: { mutationOptions: () => ({ mutationFn: async () => undefined }) } },
	},
}));

const MISSING_TEXT = /No result reached this tab/;

type AnyToolPart = ToolCallComponentProps['toolPart'];

const partWithoutOutput = (type: string, input: Record<string, unknown>): AnyToolPart =>
	({
		type,
		toolCallId: 'call-1',
		state: 'input-available',
		input,
	}) as unknown as AnyToolPart;

const renderIn = (node: React.ReactNode, toolPart: AnyToolPart, isSettled: boolean) =>
	render(
		<QueryClientProvider client={new QueryClient()}>
			<ToolCallProvider value={{ toolPart, isSettled }}>{node}</ToolCallProvider>
		</QueryClientProvider>,
	);

describe('ToolOutputFallback', () => {
	afterEach(cleanup);

	it('shows the running label while the call is in flight', () => {
		renderIn(
			<ToolOutputFallback runningLabel='Executing query...' />,
			partWithoutOutput('tool-execute_sql', {}),
			false,
		);

		expect(screen.getByText('Executing query...')).toBeDefined();
		expect(screen.queryByText(MISSING_TEXT)).toBeNull();
		expect(screen.queryByRole('button', { name: /Reload page/ })).toBeNull();
	});

	it('replaces the running label with a recoverable state once the message has settled', () => {
		renderIn(
			<ToolOutputFallback runningLabel='Executing query...' />,
			partWithoutOutput('tool-execute_sql', {}),
			true,
		);

		expect(screen.queryByText('Executing query...')).toBeNull();
		expect(screen.getByText(MISSING_TEXT)).toBeDefined();
		expect(screen.getByRole('button', { name: /Reload page/ })).toBeDefined();
	});
});
