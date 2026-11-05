// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProposeEncounterNoteToolCall } from './propose-encounter-note';
import type { ToolCallComponentProps } from '.';

const mocks = vi.hoisted(() => ({
	updateNote: vi.fn(),
	queueOrSendMessage: vi.fn(),
	cancel: vi.fn(),
	outcomes: [] as unknown[],
	messages: [] as unknown[],
}));

vi.mock('@/lib/encounter-record-api', () => ({
	encounterRecordApi: {
		encounterRecord: {
			get: { pathFilter: () => ({ queryKey: [['encounterRecord', 'get']] }) },
			updateNote: {
				mutationOptions: (options: object) => ({
					mutationFn: (input: unknown) => mocks.updateNote(input),
					...options,
				}),
			},
		},
	},
}));
vi.mock('@/lib/encounter-api', () => ({
	encounterApi: { encounter: { list: { pathFilter: () => ({ queryKey: [['encounter', 'list']] }) } } },
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
vi.mock('@/contexts/agent.provider', () => ({
	useAgentContext: () => ({ queueOrSendMessage: mocks.queueOrSendMessage, isRunning: false, chatId: 'chat-1' }),
	useAgentMessagesSelector: (select: (messages: unknown[]) => unknown) => select(mocks.messages),
}));
vi.mock('./clarification', () => ({
	findAnswerForToolCall: (messages: unknown[]) => (messages[0] as string | undefined) ?? null,
}));

const CURRENT = {
	reason: 'Fatigue',
	history: '2 weeks of fatigue',
	physicalExam: null,
	assessment: 'Hypertension',
	plan: 'HbA1c, FBS',
	patientInstructions: null,
	followUpOn: null,
	notes: null,
};

const renderCard = (input: object = { plan: 'HbA1c, FBS; recheck BP in 2 weeks' }) => {
	const toolPart = {
		type: 'tool-propose_encounter_note',
		toolCallId: 'call_1',
		state: 'output-available',
		input,
		output: {
			success: true,
			encounter: { id: 'e1', startedAt: '2026-11-03T01:00:00.000Z', clinicName: 'Health Center' },
			patientName: 'Maria Santos',
			current: CURRENT,
			version: 4,
		},
	} as unknown as ToolCallComponentProps<'propose_encounter_note'>['toolPart'];
	return render(
		<MantineProvider>
			<QueryClientProvider client={new QueryClient()}>
				<ProposeEncounterNoteToolCall toolPart={toolPart} />
			</QueryClientProvider>
		</MantineProvider>,
	);
};

const saveButton = () => screen.getByRole('button', { name: /Save changes/ });

beforeEach(() => {
	vi.clearAllMocks();
	mocks.messages = [];
	mocks.outcomes = [];
	mocks.updateNote.mockResolvedValue({ id: 'e1', version: 5 });
});
afterEach(cleanup);

describe('ProposeEncounterNoteToolCall', () => {
	it('shows the encounter and the before → after of the plan, and saves nothing until Confirm', () => {
		renderCard();
		expect(screen.getByTestId('proposal-target').textContent).toContain('Encounter note · Maria Santos');
		expect(screen.getByTestId('proposal-target').textContent).toContain('Health Center');
		const plan = screen.getByTestId('proposal-diff-plan');
		expect(plan.querySelector('del')?.textContent).toBe('HbA1c, FBS');
		expect(plan.querySelector('ins')?.textContent).toBe('HbA1c, FBS; recheck BP in 2 weeks');
		expect(screen.queryByTestId('proposal-diff-history')).toBeNull();
		expect(mocks.updateNote).not.toHaveBeenCalled();
	});

	it('saves the whole note against the drafted version, with the card origin', async () => {
		renderCard();
		fireEvent.click(saveButton());
		await waitFor(() =>
			expect(mocks.updateNote).toHaveBeenCalledWith({
				encounterId: 'e1',
				reason: 'Fatigue',
				history: '2 weeks of fatigue',
				physicalExam: null,
				assessment: 'Hypertension',
				plan: 'HbA1c, FBS; recheck BP in 2 weeks',
				patientInstructions: null,
				followUpOn: null,
				notes: null,
				expectedVersion: 4,
				wiseOrigin: {
					chatId: 'chat-1',
					toolCallId: 'call_1',
					toolName: 'propose_encounter_note',
					edited: false,
				},
			}),
		);
		await waitFor(() =>
			expect(mocks.queueOrSendMessage).toHaveBeenCalledWith({ text: 'I updated the encounter note.' }),
		);
		expect(await screen.findByText('Note updated')).toBeTruthy();
	});

	it('keeps a field the model sent blank as it is, rather than clearing it', () => {
		renderCard({ reason: '', history: ' ', plan: 'HbA1c, FBS; recheck BP in 2 weeks' });
		expect(screen.queryByTestId('proposal-diff-reason')).toBeNull();
		expect(screen.queryByTestId('proposal-diff-history')).toBeNull();
		expect(screen.getByTestId('proposal-diff-plan')).toBeTruthy();
	});

	it("marks the save as edited when the clinician changed Wise's draft", async () => {
		renderCard();
		fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
		fireEvent.change(screen.getByLabelText('Plan'), { target: { value: 'HbA1c; recheck BP in 1 week' } });
		fireEvent.click(screen.getByRole('button', { name: 'Done' }));
		expect(screen.getByTestId('proposal-diff-plan').querySelector('ins')?.textContent).toBe(
			'HbA1c; recheck BP in 1 week',
		);
		fireEvent.click(saveButton());
		await waitFor(() =>
			expect(mocks.updateNote).toHaveBeenCalledWith(
				expect.objectContaining({
					plan: 'HbA1c; recheck BP in 1 week',
					wiseOrigin: expect.objectContaining({ edited: true }),
				}),
			),
		);
	});

	it('offers a new draft when the note changed since Wise drafted it', async () => {
		mocks.updateNote.mockRejectedValue(
			new Error(
				'This note was changed after this edit was drafted. Ask Wise to re-draft it from the current note.',
			),
		);
		renderCard();
		fireEvent.click(saveButton());
		expect(await screen.findByRole('alert')).toBeTruthy();
		await waitFor(() => expect((saveButton() as HTMLButtonElement).disabled).toBe(true));

		fireEvent.click(screen.getByRole('button', { name: 'Re-draft' }));
		expect(mocks.queueOrSendMessage).toHaveBeenCalledWith({
			text: 'The record changed since your draft. Re-draft it from the current record.',
		});
	});

	it('shrinks to how it ended once answered', () => {
		mocks.messages = ['I updated the encounter note.'];
		renderCard();
		expect(screen.getByText('Note updated')).toBeTruthy();
	});
});
