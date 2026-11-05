// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	ProposeCancelOrderToolCall,
	ProposeLabOrderStepToolCall,
	ProposeOrderToolCall,
	ProposeResultReviewToolCall,
} from './propose-diagnostics-actions';
import type { ReactNode } from 'react';

const mocks = vi.hoisted(() => ({
	record: null as unknown,
	results: [] as unknown[],
	tests: [] as unknown[],
	orders: [] as unknown[],
	worklist: [] as unknown[],
	calls: {} as Record<string, ReturnType<typeof vi.fn>>,
	queueOrSendMessage: vi.fn(),
	query: (key: string, data: () => unknown) => ({
		queryOptions: (input?: object) => ({ queryKey: [key, input], queryFn: data }),
		pathFilter: () => ({ queryKey: [key] }),
	}),
}));

const call = (name: string) => {
	mocks.calls[name] = vi.fn().mockResolvedValue({ id: 'x' });
	return { mutate: (input: unknown) => mocks.calls[name](input) };
};

vi.mock('@/lib/encounter-record-api', () => ({
	encounterRecordApi: { encounterRecord: { get: mocks.query('record', () => mocks.record) } },
}));
vi.mock('@/lib/result-api', () => ({
	resultApi: {
		result: {
			forPatient: mocks.query('results', () => mocks.results),
			review: { mutate: (input: unknown) => mocks.calls.review(input) },
		},
	},
}));
vi.mock('@/lib/orders-api', () => ({
	ordersApi: {
		order: {
			tests: mocks.query('tests', () => mocks.tests),
			forEncounter: mocks.query('orders', () => mocks.orders),
			worklist: mocks.query('worklist', () => mocks.worklist),
			create: { mutate: (input: unknown) => mocks.calls.create(input) },
			cancel: { mutate: (input: unknown) => mocks.calls.cancel(input) },
			collect: { mutate: (input: unknown) => mocks.calls.collect(input) },
			start: { mutate: (input: unknown) => mocks.calls.start(input) },
			release: { mutate: (input: unknown) => mocks.calls.release(input) },
		},
	},
}));
vi.mock('@/lib/patient-api', () => ({ patientApi: { patient: {} } }));
vi.mock('@/contexts/agent.provider', () => ({
	useAgentContext: () => ({ queueOrSendMessage: mocks.queueOrSendMessage, isRunning: false, chatId: 'chat-1' }),
	useAgentMessagesSelector: () => null,
}));
vi.mock('@/lib/wise-proposal-api', () => ({
	wiseProposalApi: {
		wiseProposal: {
			outcomes: {
				queryOptions: () => ({ queryKey: ['wiseProposal', 'outcomes'], queryFn: () => [] }),
				pathFilter: () => ({ queryKey: ['wiseProposal', 'outcomes'] }),
			},
			cancel: { mutationOptions: (options: object) => ({ mutationFn: vi.fn(), ...options }) },
		},
	},
}));
vi.mock('./clarification', () => ({ findAnswerForToolCall: () => null }));
vi.mock('@tanstack/react-router', () => ({ Link: ({ children }: { children: ReactNode }) => <a>{children}</a> }));

const origin = (toolName: string, edited = false) => ({ chatId: 'chat-1', toolCallId: 'call_1', toolName, edited });

const renderCard = (Card: React.ComponentType<any>, type: string, input: object, output: object = {}) =>
	render(
		<MantineProvider>
			<QueryClientProvider client={new QueryClient()}>
				<Card
					toolPart={{
						type: `tool-${type}`,
						toolCallId: 'call_1',
						state: 'output-available',
						input,
						output: { success: true, patientId: 'p1', ...output },
					}}
				/>
			</QueryClientProvider>
		</MantineProvider>,
	);

const click = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));

const hba1c = { id: 't-hba1c', code: 'HBA1C', name: 'Hemoglobin A1c (HbA1c)', category: 'LABORATORY' };

beforeEach(() => {
	vi.clearAllMocks();
	for (const name of ['review', 'create', 'cancel', 'collect', 'start', 'release']) {
		call(name);
	}
	mocks.record = {
		canEdit: true,
		encounter: { id: 'e1', patientId: 'p1', reason: 'BP check', startedAt: '2026-11-03T01:00:00.000Z' },
	};
	mocks.results = [];
	mocks.tests = [hba1c];
	mocks.orders = [];
	mocks.worklist = [];
});
afterEach(cleanup);

describe('diagnostics Wise cards', () => {
	it('reviews a critical result only with a note and a second click', async () => {
		mocks.results = [
			{
				id: 'r1',
				test: hba1c,
				order: { orderNo: 'TAG-LAB-2026-000001' },
				values: [
					{
						id: 'v1',
						name: 'HbA1c',
						value: '12.4',
						unit: '%',
						referenceRange: '4–5.6',
						flag: 'CRITICAL_HIGH',
					},
				],
				flag: 'CRITICAL_HIGH',
				urgency: 'CRITICAL',
				findings: null,
				impression: null,
				remarks: null,
				reviewedAt: null,
			},
		];
		renderCard(ProposeResultReviewToolCall, 'propose_result_review', { resultId: 'r1' }, { subjectId: 'r1' });
		expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('act now'));
		expect(screen.getByTestId('review-result').textContent).toContain('12.4 %');
		expect(screen.getByRole('button', { name: /Mark critical result reviewed/ })).toHaveProperty('disabled', true);
		fireEvent.change(screen.getByLabelText(/Note/), { target: { value: 'Called the patient' } });
		click(/Mark critical result reviewed/);
		expect(mocks.calls.review).not.toHaveBeenCalled();
		click(/Yes, mark critical result reviewed/);
		await waitFor(() =>
			expect(mocks.calls.review).toHaveBeenCalledWith({
				resultId: 'r1',
				note: 'Called the patient',
				wiseOrigin: origin('propose_result_review', true),
			}),
		);
	});

	it("orders the tests the clinic's catalog offers, and refuses one it doesn't", async () => {
		renderCard(
			ProposeOrderToolCall,
			'propose_order',
			{ encounterId: 'e1', tests: ['HbA1c'], priority: 'urgent', clinicalInfo: 'T2DM' },
			{ subjectId: 'e1', tests: [{ code: 'HBA1C', display: 'Hemoglobin A1c (HbA1c)', category: 'LABORATORY' }] },
		);
		await waitFor(() =>
			expect(screen.getByRole('button', { name: /Order test/ })).toHaveProperty('disabled', false),
		);
		expect(screen.getByLabelText('Priority')).toHaveProperty('value', 'URGENT');
		click(/Order test/);
		await waitFor(() =>
			expect(mocks.calls.create).toHaveBeenCalledWith({
				encounterId: 'e1',
				testIds: ['t-hba1c'],
				priority: 'URGENT',
				clinicalInfo: 'T2DM',
				wiseOrigin: origin('propose_order'),
			}),
		);
		cleanup();

		mocks.tests = [];
		renderCard(
			ProposeOrderToolCall,
			'propose_order',
			{ encounterId: 'e1', tests: ['HbA1c'] },
			{ subjectId: 'e1', tests: [{ code: 'HBA1C', display: 'Hemoglobin A1c (HbA1c)', category: 'LABORATORY' }] },
		);
		expect(await screen.findByText(/Not in the clinic's test list/)).toBeTruthy();
		expect(screen.getByRole('button', { name: /Order/ })).toHaveProperty('disabled', true);
	});

	it('cancels the named test of the visit with the reason', async () => {
		mocks.orders = [
			{
				id: 'o1',
				orderNo: 'TAG-LAB-2026-000002',
				items: [{ id: 'i1', status: 'REQUESTED', test: hba1c }],
			},
		];
		renderCard(
			ProposeCancelOrderToolCall,
			'propose_cancel_order',
			{ encounterId: 'e1', test: 'HbA1c' },
			{ subjectId: 'e1' },
		);
		expect(await screen.findByText(/Hemoglobin A1c \(HbA1c\) · Requested/)).toBeTruthy();
	});

	it('marks a worklist test collected with the accession number from the lab desk card', async () => {
		mocks.worklist = [
			{
				id: 'i1',
				status: 'REQUESTED',
				test: { ...hba1c, parameters: [] },
				result: null,
				order: { id: 'o1', orderNo: 'TAG-LAB-2026-000003', priority: 'STAT', requestedByName: 'Dr. Ana Reyes' },
				patient: { firstName: 'Pedro', lastName: 'Villanueva' },
			},
		];
		renderCard(
			ProposeLabOrderStepToolCall,
			'propose_lab_order_step',
			{ itemId: 'i1', step: 'collect' },
			{ subjectId: 'i1', patientId: undefined },
		);
		expect((await screen.findByTestId('lab-order')).textContent).toContain('Pedro Villanueva');
		fireEvent.change(screen.getByLabelText('Accession number'), { target: { value: 'ACC-9' } });
		click(/^Mark collected$/);
		await waitFor(() =>
			expect(mocks.calls.collect).toHaveBeenCalledWith({
				itemId: 'i1',
				accessionNo: 'ACC-9',
				wiseOrigin: origin('propose_lab_order_step', true),
			}),
		);
	});
});
