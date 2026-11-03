// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OpenPageToolCall } from './open-page';
import type { ToolCallComponentProps } from '.';

const PATIENT_ID = '334d301e-8bec-4e38-b6f0-ee218b3e21b0';

const mocks = vi.hoisted(() => ({
	navigate: vi.fn(),
	agent: { chatId: 'chat-1', isRunning: false, disableNavigation: false as boolean | undefined },
	pathname: '/chat-1',
}));

vi.mock('@tanstack/react-router', () => ({
	useNavigate: () => mocks.navigate,
	useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => unknown }) =>
		select({ location: { pathname: mocks.pathname } }),
	Link: ({ to, params, children, className }: Record<string, never>) => (
		<a
			href={String(to).replace('$patientId', (params as { patientId?: string })?.patientId ?? '')}
			className={className}
		>
			{children}
		</a>
	),
}));
vi.mock('@/contexts/agent.provider', () => ({ useAgentContext: () => mocks.agent }));

let toolCallCounter = 0;

const part = (state: string, autoNavigate = true, toolCallId = `call_${++toolCallCounter}`) =>
	({
		type: 'tool-open_page',
		toolCallId,
		state,
		input: { page: 'patients.detail', params: { patientId: PATIENT_ID }, userAskedToOpen: autoNavigate },
		...(state === 'output-available' && {
			output: {
				_version: '1',
				key: 'patients.detail',
				params: { patientId: PATIENT_ID },
				label: "Maria Santos's chart",
				autoNavigate,
			},
		}),
	}) as unknown as ToolCallComponentProps<'open_page'>['toolPart'];

const renderPart = (toolPart: ToolCallComponentProps<'open_page'>['toolPart']) =>
	render(
		<MantineProvider>
			<OpenPageToolCall toolPart={toolPart} />
		</MantineProvider>,
	);

/** Streams a part live: input, then output while the run goes on, then the run ends. */
const streamLive = (autoNavigate = true) => {
	const toolCallId = `call_${++toolCallCounter}`;
	mocks.agent.isRunning = true;
	const view = renderPart(part('input-available', autoNavigate, toolCallId));
	view.rerender(
		<MantineProvider>
			<OpenPageToolCall toolPart={part('output-available', autoNavigate, toolCallId)} />
		</MantineProvider>,
	);
	expect(mocks.navigate).not.toHaveBeenCalled();
	mocks.agent.isRunning = false;
	view.rerender(
		<MantineProvider>
			<OpenPageToolCall toolPart={{ ...part('output-available', autoNavigate, toolCallId) }} />
		</MantineProvider>,
	);
	return { view, toolCallId };
};

beforeEach(() => {
	vi.clearAllMocks();
	mocks.agent = { chatId: 'chat-1', isRunning: false, disableNavigation: false };
	mocks.pathname = '/chat-1';
});

afterEach(cleanup);

describe('OpenPageToolCall', () => {
	it('links to the page', () => {
		renderPart(part('output-available', false));
		expect(screen.getByText("Maria Santos's chart")).toBeTruthy();
		expect(screen.getByRole('link', { name: /Open/ }).getAttribute('href')).toBe(`/patients/${PATIENT_ID}`);
	});

	it('goes there by itself once the reply it watched ends, when the user asked', () => {
		const { view, toolCallId } = streamLive();
		expect(mocks.navigate).toHaveBeenCalledTimes(1);
		expect(mocks.navigate).toHaveBeenCalledWith({
			to: `/patients/${PATIENT_ID}`,
			state: { fromChatId: 'chat-1' },
		});

		// Coming back to the chat remounts the card: it stays put.
		view.unmount();
		mocks.agent.isRunning = true;
		const again = renderPart(part('input-available', true, toolCallId));
		mocks.agent.isRunning = false;
		again.rerender(
			<MantineProvider>
				<OpenPageToolCall toolPart={part('output-available', true, toolCallId)} />
			</MantineProvider>,
		);
		expect(mocks.navigate).toHaveBeenCalledTimes(1);
	});

	it('never navigates for a stored part (a reopened or replayed chat)', () => {
		renderPart(part('output-available', true));
		expect(mocks.navigate).not.toHaveBeenCalled();
	});

	it('waits for the click when the user did not ask to go there', () => {
		streamLive(false);
		expect(mocks.navigate).not.toHaveBeenCalled();
	});

	it('never navigates from an embedded chat (the patient chart panel)', () => {
		mocks.agent.disableNavigation = true;
		streamLive();
		expect(mocks.navigate).not.toHaveBeenCalled();
		expect(screen.getByRole('link', { name: /Open/ })).toBeTruthy();
	});

	it('says so when the page is already open', () => {
		mocks.pathname = `/patients/${PATIENT_ID}`;
		streamLive();
		expect(mocks.navigate).not.toHaveBeenCalled();
		expect(screen.getByText('You are here')).toBeTruthy();
	});

	it('shows why the page could not be opened', () => {
		renderPart({
			...part('output-error'),
			errorText: 'No patient the user may see has this id.',
		} as ToolCallComponentProps<'open_page'>['toolPart']);
		expect(screen.getByText(/No patient the user may see/)).toBeTruthy();
	});
});
