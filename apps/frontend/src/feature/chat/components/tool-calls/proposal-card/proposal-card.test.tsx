// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FileText } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { diffFields } from './diff-fields';
import { ProposalCard } from './proposal-card';
import type { ComponentProps } from 'react';

const mocks = vi.hoisted(() => ({
	queueOrSendMessage: vi.fn(),
	cancel: vi.fn(),
	outcomes: [] as unknown[],
	messages: [] as unknown[],
}));

vi.mock('@/contexts/agent.provider', () => ({
	useAgentContext: () => ({ queueOrSendMessage: mocks.queueOrSendMessage, isRunning: false, chatId: 'chat-1' }),
	useAgentMessagesSelector: (select: (messages: unknown[]) => unknown) => select(mocks.messages),
}));
vi.mock('../clarification', () => ({
	findAnswerForToolCall: (messages: unknown[]) => (messages[0] as string | undefined) ?? null,
}));
vi.mock('@/lib/wise-proposal-api', () => ({
	wiseProposalApi: {
		wiseProposal: {
			outcomes: {
				queryOptions: () => ({ queryKey: ['wiseProposal', 'outcomes'], queryFn: () => mocks.outcomes }),
				pathFilter: () => ({ queryKey: ['wiseProposal', 'outcomes'] }),
			},
			cancel: { mutationOptions: (options: object) => ({ mutationFn: mocks.cancel, ...options }) },
		},
	},
}));

type Props = ComponentProps<typeof ProposalCard>;

const LABELS = { reason: 'Chief complaint', plan: 'Plan', notes: 'Other notes' };
const ORIGIN = { chatId: 'chat-1', toolCallId: 'call_1', toolName: 'propose_thing' };

const renderCard = (props: Partial<Props> = {}) =>
	render(
		<>
			<QueryClientProvider client={new QueryClient()}>
				<ProposalCard
					toolCallId='call_1'
					toolName='propose_thing'
					icon={FileText}
					title='Thing'
					confirmLabel='Save'
					onConfirm={vi.fn()}
					resolvedLabels={{ confirmed: 'Saved', cancelled: 'Not saved' }}
					isConfirmedAnswer={(answer) => answer.startsWith('I saved')}
					{...(props as object)}
				>
					<p>Draft body</p>
				</ProposalCard>
			</QueryClientProvider>
		</>,
	);

const button = (name: RegExp | string) => screen.getByRole('button', { name });

beforeEach(() => {
	vi.clearAllMocks();
	mocks.messages = [];
	mocks.outcomes = [];
	mocks.cancel.mockResolvedValue({ toolCallId: 'call_1', status: 'cancelled' });
});
afterEach(cleanup);

describe('diffFields', () => {
	it('marks only real changes, ignoring blank and surrounding whitespace', () => {
		expect(
			diffFields(
				{ reason: 'Fatigue', plan: null, notes: ' ' },
				{ reason: 'Fatigue ', plan: 'Labs', notes: '' },
				LABELS,
			),
		).toEqual([
			{ key: 'reason', label: 'Chief complaint', before: 'Fatigue', after: 'Fatigue', changed: false },
			{ key: 'plan', label: 'Plan', before: null, after: 'Labs', changed: true },
			{ key: 'notes', label: 'Other notes', before: null, after: null, changed: false },
		]);
	});
});

describe('ProposalCard', () => {
	it('never confirms by itself, also when the chat replays the card', () => {
		const onConfirm = vi.fn();
		const { rerender } = renderCard({ onConfirm });
		rerender(
			<>
				<QueryClientProvider client={new QueryClient()}>
					<ProposalCard
						toolCallId='call_1'
						toolName='propose_thing'
						icon={FileText}
						title='Thing'
						confirmLabel='Save'
						onConfirm={onConfirm}
						resolvedLabels={{ confirmed: 'Saved', cancelled: 'Not saved' }}
						isConfirmedAnswer={() => false}
					/>
				</QueryClientProvider>
			</>,
		);
		expect(onConfirm).not.toHaveBeenCalled();
	});

	it('passes the card origin to the mutation and drops a second Confirm while the first runs', async () => {
		let finish: () => void = () => undefined;
		const onConfirm = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
		renderCard({ onConfirm });
		fireEvent.click(button('Save'));
		fireEvent.click(button('Save'));
		expect(onConfirm).toHaveBeenCalledTimes(1);
		expect(onConfirm).toHaveBeenCalledWith({ origin: ORIGIN });

		finish();
		// Settled here at once, before the follow-up message arrives: Confirm never comes back.
		expect(await screen.findByText('Saved')).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
	});

	it('unlocks when the confirm stopped early or saved nothing', async () => {
		const onConfirm = vi.fn().mockReturnValueOnce(undefined).mockResolvedValueOnce(false);
		renderCard({ onConfirm });
		fireEvent.click(button('Save'));
		await waitFor(() => expect((button('Save') as HTMLButtonElement).disabled).toBe(false));
		fireEvent.click(button('Save'));
		await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(2));
		await waitFor(() => expect((button('Save') as HTMLButtonElement).disabled).toBe(false));
	});

	it('shows a card the API already settled as settled, even with no answer in the chat', async () => {
		mocks.outcomes = [{ toolCallId: 'call_1', toolName: 'propose_thing', status: 'confirmed', resourceId: 'r1' }];
		renderCard();
		expect(await screen.findByText('Saved')).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
	});

	it('shows a card answered in the chat as settled', () => {
		mocks.messages = ['Cancel this proposal.'];
		renderCard();
		expect(screen.getByText('Not saved')).toBeTruthy();
	});

	it('cancels through the API, so the card can no longer be confirmed, then tells Wise', async () => {
		renderCard();
		fireEvent.click(button(/Cancel/));
		await waitFor(() => expect(mocks.cancel).toHaveBeenCalledWith({ ...ORIGIN, edited: false }, expect.anything()));
		await waitFor(() => expect(mocks.queueOrSendMessage).toHaveBeenCalledWith({ text: 'Cancel this proposal.' }));
	});

	describe('update mode', () => {
		const changes = diffFields(
			{ reason: 'Fatigue', plan: 'Labs', notes: null },
			{ reason: 'Fatigue', plan: 'Labs; recheck BP in 2 weeks', notes: null },
			LABELS,
		);

		it('names the record and shows before → after of the changed fields only', () => {
			renderCard({
				mode: 'update',
				target: { label: 'Encounter note', detail: 'Maria Santos · 3 Nov' },
				changes,
			});
			expect(screen.getByTestId('proposal-target').textContent).toBe('Encounter note · Maria Santos · 3 Nov');
			expect(screen.getByText('Changes an existing record · needs your confirmation')).toBeTruthy();
			const plan = screen.getByTestId('proposal-diff-plan');
			expect(plan.querySelector('del')?.textContent).toBe('Labs');
			expect(plan.querySelector('ins')?.textContent).toBe('Labs; recheck BP in 2 weeks');
			expect(screen.queryByTestId('proposal-diff-reason')).toBeNull();
			expect(screen.queryByText('Draft body')).toBeNull();

			fireEvent.click(button('Show 2 unchanged fields'));
			expect(screen.getByText('Fatigue')).toBeTruthy();
		});

		it('shows the edit fields while editing', () => {
			renderCard({ mode: 'update', target: { label: 'Note' }, changes, isEditing: true, onEditToggle: vi.fn() });
			expect(screen.getByText('Draft body')).toBeTruthy();
		});

		it('cannot confirm a change that changes nothing', () => {
			const same = diffFields({ plan: 'Labs' }, { plan: 'Labs' }, { plan: 'Plan' });
			renderCard({ mode: 'update', target: { label: 'Note' }, changes: same });
			expect(screen.getByText('Nothing would change.')).toBeTruthy();
			expect((button('Save') as HTMLButtonElement).disabled).toBe(true);
		});
	});

	describe('destructive mode', () => {
		it('needs a reason and a second click, then passes the reason', async () => {
			const onConfirm = vi.fn().mockResolvedValue(undefined);
			renderCard({ mode: 'destructive', target: { label: 'Prescription' }, confirmLabel: 'Void', onConfirm });
			expect(screen.getByText('Removes a record · needs your confirmation')).toBeTruthy();
			expect((button('Void') as HTMLButtonElement).disabled).toBe(true);

			fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'ok' } });
			expect((button('Void') as HTMLButtonElement).disabled).toBe(true);
			fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Wrong patient' } });
			fireEvent.click(button('Void'));
			expect(onConfirm).not.toHaveBeenCalled();

			fireEvent.click(button('Yes, void'));
			await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({ origin: ORIGIN, reason: 'Wrong patient' }));
		});
	});
});
