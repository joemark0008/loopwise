// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProposeEncounterToolCall } from './propose-encounter';
import type { ToolCallComponentProps } from '.';

const mocks = vi.hoisted(() => ({
	create: vi.fn(),
	recordVitals: vi.fn(),
	addDiagnosis: vi.fn(),
	queueOrSendMessage: vi.fn(),
	cancel: vi.fn(),
	outcomes: [] as unknown[],
	messages: [] as unknown[],
}));

vi.mock('@/lib/encounter-api', () => ({
	encounterApi: {
		encounter: {
			list: { pathFilter: () => ({ queryKey: [['encounter', 'list']] }) },
			create: {
				mutationOptions: (options: object) => ({
					mutationFn: (input: unknown) => mocks.create(input),
					...options,
				}),
			},
		},
	},
}));
vi.mock('@/lib/encounter-record-api', () => ({
	encounterRecordApi: {
		encounterRecord: {
			recordVitals: { mutate: (input: unknown) => mocks.recordVitals(input) },
			addDiagnosis: { mutate: (input: unknown) => mocks.addDiagnosis(input) },
		},
	},
}));
vi.mock('@/contexts/agent.provider', () => ({
	useAgentContext: () => ({ queueOrSendMessage: mocks.queueOrSendMessage, isRunning: false, chatId: 'chat-1' }),
	useAgentMessagesSelector: (select: (messages: unknown[]) => unknown) => select(mocks.messages),
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
vi.mock('./clarification', () => ({
	findAnswerForToolCall: (messages: unknown[]) => (messages[0] as string | undefined) ?? null,
}));

const renderCard = (input: object = { reason: 'Fatigue, BP check', notes: 'BP 150/95.' }) => {
	const toolPart = {
		type: 'tool-propose_encounter',
		toolCallId: 'call_1',
		state: 'output-available',
		input,
		output: { success: true, patientId: 'p1', facilities: [{ id: 'hc', name: 'Health Center' }] },
	} as unknown as ToolCallComponentProps<'propose_encounter'>['toolPart'];
	return render(
		<MantineProvider>
			<QueryClientProvider client={new QueryClient()}>
				<ProposeEncounterToolCall toolPart={toolPart} />
			</QueryClientProvider>
		</MantineProvider>,
	);
};

const saveButton = () => screen.getByRole('button', { name: /Save encounter/ });

beforeEach(() => {
	vi.clearAllMocks();
	mocks.messages = [];
	mocks.outcomes = [];
	mocks.create.mockResolvedValue({ id: 'e1', reason: 'Fatigue, BP check' });
	mocks.recordVitals.mockResolvedValue({ id: 'v1' });
	mocks.addDiagnosis.mockResolvedValue({ id: 'd1' });
});
afterEach(cleanup);

describe('ProposeEncounterToolCall', () => {
	it('shows the draft and saves it for the chat patient, linked to the chat', async () => {
		renderCard();
		expect(screen.getByText('Fatigue, BP check')).toBeTruthy();
		expect(screen.getByText('BP 150/95.')).toBeTruthy();
		expect(mocks.create).not.toHaveBeenCalled();

		fireEvent.click(saveButton());
		await waitFor(() =>
			expect(mocks.create).toHaveBeenCalledWith(
				expect.objectContaining({
					patientId: 'p1',
					facilityId: 'hc',
					reason: 'Fatigue, BP check',
					notes: 'BP 150/95.',
					sourceChatId: 'chat-1',
					wiseOrigin: {
						chatId: 'chat-1',
						toolCallId: 'call_1',
						toolName: 'propose_encounter',
						edited: false,
					},
				}),
			),
		);
		await waitFor(() =>
			expect(mocks.queueOrSendMessage).toHaveBeenCalledWith({
				text: 'I recorded the encounter: Fatigue, BP check.',
			}),
		);
	});

	it('saves what the clinician edited', async () => {
		renderCard();
		fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
		fireEvent.change(screen.getByLabelText('Reason for visit'), { target: { value: 'Follow-up' } });
		fireEvent.click(saveButton());
		await waitFor(() =>
			expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ reason: 'Follow-up' })),
		);
	});

	it('opens the fields with the error when the reason is missing', async () => {
		renderCard({ reason: '' });
		fireEvent.click(saveButton());
		expect(await screen.findByText('Add the reason for the visit.')).toBeTruthy();
		expect(mocks.create).not.toHaveBeenCalled();
	});

	it('records the drafted vitals and diagnoses after the encounter, first diagnosis primary', async () => {
		renderCard({
			reason: 'BP check',
			vitals: { systolicMmHg: 140, diastolicMmHg: 90, weightKg: 72, heightCm: 155 },
			diagnoses: [
				{ icd10Code: 'I10', display: 'Essential (primary) hypertension' },
				{ icd10Code: 'R53', display: 'Malaise and fatigue' },
			],
		});
		expect(screen.getByTestId('drafted-vitals').textContent).toBe('BP 140/90 · Wt 72 kg · Ht 155 cm · BMI 30.0');
		fireEvent.click(saveButton());
		await waitFor(() => expect(mocks.addDiagnosis).toHaveBeenCalledTimes(2));
		expect(mocks.recordVitals).toHaveBeenCalledWith({
			encounterId: 'e1',
			systolicMmHg: 140,
			diastolicMmHg: 90,
			weightKg: 72,
			heightCm: 155,
			wiseOrigin: { chatId: 'chat-1', toolCallId: 'call_1', toolName: 'propose_encounter', edited: false },
		});
		expect(mocks.addDiagnosis).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				icd10Code: 'I10',
				isPrimary: true,
				wiseOrigin: expect.objectContaining({ toolCallId: 'call_1' }),
			}),
		);
		expect(mocks.addDiagnosis).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ icd10Code: 'R53', isPrimary: false }),
		);
	});

	it('ignores unstated vitals sent as 0', () => {
		renderCard({
			reason: 'BP check',
			vitals: { systolicMmHg: 0, diastolicMmHg: 0, painScore: 0, heartRateBpm: 80 },
		});
		expect(screen.getByTestId('drafted-vitals').textContent).toBe('HR 80');
	});

	it('leaves out implausible drafted vitals and says so', () => {
		renderCard({ reason: 'BP check', vitals: { systolicMmHg: 90, diastolicMmHg: 120 } });
		expect(screen.getByText(/Vitals left out: Diastolic must be below systolic/)).toBeTruthy();
	});

	it('shrinks to how it ended once answered', () => {
		mocks.messages = ['I recorded the encounter: Fatigue, BP check.'];
		renderCard();
		expect(screen.getByText('Recorded')).toBeTruthy();
	});
});
