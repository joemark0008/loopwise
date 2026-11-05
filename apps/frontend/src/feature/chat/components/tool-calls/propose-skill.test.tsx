// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProposeSkillToolCall } from './propose-skill';
import type { ToolCallComponentProps } from '.';

const mocks = vi.hoisted(() => ({
	saveStatus: vi.fn(),
	create: vi.fn(),
	queueOrSendMessage: vi.fn(),
	permissions: { isAdmin: true, isContextAdmin: false },
	messages: [] as unknown[],
}));

vi.mock('@/lib/skill-api', () => {
	const key = (name: string) => () => ['skill', name];
	return {
		skillApi: {
			skill: {
				saveStatus: { queryOptions: () => ({ queryKey: ['skill', 'saveStatus'], queryFn: mocks.saveStatus }) },
				list: { queryKey: key('list') },
				catalog: { queryKey: key('catalog') },
				create: {
					mutationOptions: (options: object) => ({
						mutationFn: (input: unknown) => mocks.create(input),
						...options,
					}),
				},
			},
		},
	};
});
vi.mock('@/hooks/use-permissions', () => ({ usePermissions: () => mocks.permissions }));
vi.mock('@/contexts/agent.provider', () => ({
	useAgentContext: () => ({ queueOrSendMessage: mocks.queueOrSendMessage, isRunning: false }),
	useAgentMessagesSelector: (select: (messages: unknown[]) => unknown) => select(mocks.messages),
}));
vi.mock('./clarification', () => ({
	findAnswerForToolCall: (messages: unknown[]) => (messages[0] as string | undefined) ?? null,
}));

const DRAFT = { name: 'churn-analysis', description: 'Use for churn.', body: '1. Do the thing.' };

const renderCard = (overrides: object = {}) => {
	const toolPart = {
		type: 'tool-propose_skill',
		toolCallId: 'call_1',
		state: 'output-available',
		input: DRAFT,
		output: { success: true },
		...overrides,
	} as unknown as ToolCallComponentProps<'propose_skill'>['toolPart'];
	return render(
		<MantineProvider>
			<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
				<ProposeSkillToolCall toolPart={toolPart} />
			</QueryClientProvider>
		</MantineProvider>,
	);
};

const saveButton = () => screen.findByRole('button', { name: 'Save skill' });

beforeEach(() => {
	vi.clearAllMocks();
	mocks.permissions = { isAdmin: true, isContextAdmin: false };
	mocks.messages = [];
	mocks.saveStatus.mockResolvedValue({ mode: 'direct', message: null });
	mocks.create.mockResolvedValue({ name: DRAFT.name, location: '/agent/skills/churn-analysis.md' });
});
afterEach(cleanup);

describe('ProposeSkillToolCall', () => {
	it('shows the whole draft and saves nothing until asked', async () => {
		renderCard();
		await saveButton();
		expect(screen.getByText(`/${DRAFT.name}`)).toBeTruthy();
		expect(screen.getByText(DRAFT.description)).toBeTruthy();
		expect(screen.getByText(DRAFT.body)).toBeTruthy();
		expect(mocks.create).not.toHaveBeenCalled();
	});

	it('follows the draft while it streams, and saves all of it', async () => {
		const part = (body: string, state: string) =>
			({
				type: 'tool-propose_skill',
				toolCallId: 'call_1',
				state,
				input: { ...DRAFT, body },
			}) as unknown as ToolCallComponentProps<'propose_skill'>['toolPart'];
		const card = (body: string, state: string) => (
			<MantineProvider>
				<QueryClientProvider client={client}>
					<ProposeSkillToolCall toolPart={part(body, state)} />
				</QueryClientProvider>
			</MantineProvider>
		);
		const client = new QueryClient();
		const { rerender } = render(card('#', 'input-streaming'));
		expect(((await saveButton()) as HTMLButtonElement).disabled).toBe(true);

		rerender(card(DRAFT.body, 'output-available'));
		expect(screen.getByText(DRAFT.body)).toBeTruthy();
		await waitFor(async () => expect(((await saveButton()) as HTMLButtonElement).disabled).toBe(false));
		fireEvent.click(await saveButton());
		await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(DRAFT));
	});

	it('saves the draft and tells the agent', async () => {
		renderCard();
		fireEvent.click(await saveButton());
		await waitFor(() =>
			expect(mocks.queueOrSendMessage).toHaveBeenCalledWith({ text: 'I saved the skill "churn-analysis".' }),
		);
		expect(mocks.create).toHaveBeenCalledWith(DRAFT);
	});

	it('saves what the person edited', async () => {
		renderCard();
		await saveButton();
		fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
		fireEvent.change(screen.getByLabelText('Skill instructions'), { target: { value: 'Edited steps' } });
		fireEvent.click(await saveButton());
		await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ ...DRAFT, body: 'Edited steps' }));
	});

	it('keeps the draft and shows the error when saving fails', async () => {
		mocks.create.mockRejectedValue(new Error('A skill called churn-analysis already exists.'));
		renderCard();
		fireEvent.click(await saveButton());
		expect(await screen.findByText(/already exists/)).toBeTruthy();
		expect(mocks.queueOrSendMessage).not.toHaveBeenCalled();
		expect(screen.getByRole('button', { name: 'Save skill' })).toBeTruthy();
	});

	it('discards through a message, without saving', async () => {
		renderCard();
		await saveButton();
		fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
		expect(mocks.queueOrSendMessage).toHaveBeenCalledWith({ text: 'Discard this skill draft.' });
		expect(mocks.create).not.toHaveBeenCalled();
	});

	it('offers members a copy instead of Save', async () => {
		mocks.permissions = { isAdmin: false, isContextAdmin: false };
		renderCard();
		expect(await screen.findByRole('button', { name: 'Copy' })).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Save skill' })).toBeNull();
		expect(screen.getByText(/Only clinic admins/)).toBeTruthy();
		expect(mocks.saveStatus).not.toHaveBeenCalled();
	});

	it.each([['disabled', 'This deployment manages skills as files.']])(
		'offers a copy and the reason in %s mode',
		async (mode, message) => {
			mocks.saveStatus.mockResolvedValue({ mode, message });
			renderCard();
			expect(await screen.findByText(message)).toBeTruthy();
			expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
			expect(screen.queryByRole('button', { name: 'Save skill' })).toBeNull();
		},
	);

	it('collapses once answered, which survives a reload', async () => {
		mocks.messages = ['I saved the skill "churn-analysis".'];
		renderCard();
		expect(await screen.findByText('Saved')).toBeTruthy();
		mocks.messages = ['Discard this skill draft.'];
		cleanup();
		renderCard();
		expect(await screen.findByText('Not saved')).toBeTruthy();
	});
});
