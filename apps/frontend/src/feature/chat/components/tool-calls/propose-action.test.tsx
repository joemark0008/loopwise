// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProposeAllergyToolCall, ProposeRemoveAllergyToolCall, ProposeVitalsToolCall } from './propose-action';
import type { ReactNode } from 'react';

const mocks = vi.hoisted(() => ({
	record: null as unknown,
	allergies: [] as unknown[],
	results: [] as unknown[],
	recordVitals: vi.fn(),
	addAllergy: vi.fn(),
	voidAllergy: vi.fn(),
	createOrders: vi.fn(),
	review: vi.fn(),
	queueOrSendMessage: vi.fn(),
	query: (key: string, data: () => unknown) => ({
		queryOptions: (input?: object) => ({ queryKey: [key, input], queryFn: data }),
		pathFilter: () => ({ queryKey: [key] }),
	}),
	mutation: (fn: (input: unknown) => unknown) => ({
		mutationOptions: (options: object) => ({ mutationFn: (input: unknown) => fn(input), ...options }),
	}),
}));

vi.mock('@/lib/encounter-record-api', () => ({
	encounterRecordApi: {
		encounterRecord: {
			get: mocks.query('record', () => mocks.record),
			allergies: mocks.query('allergies', () => mocks.allergies),
			orderOptions: mocks.query('orderOptions', () => ({
				orderableTests: [],
				orderTargets: [
					{ id: 'lab1', name: 'Bohol Diagnostics' },
					{ id: 'lab2', name: 'Provincial Hospital' },
				],
			})),
			recordVitals: mocks.mutation((input) => mocks.recordVitals(input)),
			addAllergy: mocks.mutation((input) => mocks.addAllergy(input)),
			voidAllergy: mocks.mutation((input) => mocks.voidAllergy(input)),
			createOrders: mocks.mutation((input) => mocks.createOrders(input)),
		},
	},
}));
vi.mock('@/lib/result-api', () => ({
	resultApi: {
		result: {
			forPatient: mocks.query('results', () => mocks.results),
			toReview: mocks.query('toReview', () => []),
			review: mocks.mutation((input) => mocks.review(input)),
		},
	},
}));
vi.mock('@/lib/wise-actions-api', () => ({
	wiseActionsApi: { resultEvaluation: mocks.query('evaluation', () => null) },
}));
vi.mock('@/lib/patient-api', () => ({
	patientApi: { patient: { clinics: mocks.query('clinics', () => [{ id: 'c1', name: 'Health Center' }]) } },
}));
vi.mock('@/lib/encounter-api', () => ({
	encounterApi: { encounter: { list: { pathFilter: () => ({ queryKey: ['encounters'] }) } } },
}));
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

const record = {
	canEdit: true,
	encounter: { id: 'e1', patientId: 'p1', reason: 'BP check', startedAt: '2026-11-03T01:00:00.000Z' },
};

const origin = (toolName: string) => ({ chatId: 'chat-1', toolCallId: 'call_1', toolName, edited: false });

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

beforeEach(() => {
	vi.clearAllMocks();
	mocks.record = record;
	mocks.allergies = [];
	mocks.results = [];
	for (const fn of [mocks.recordVitals, mocks.addAllergy, mocks.voidAllergy, mocks.createOrders, mocks.review]) {
		fn.mockResolvedValue({ id: 'x' });
	}
});
afterEach(cleanup);

describe('Wise action cards', () => {
	it('records the stated vitals on the visit with the card origin, and nothing before Confirm', async () => {
		renderCard(
			ProposeVitalsToolCall,
			'propose_vitals',
			{ encounterId: 'e1', vitals: { systolicMmHg: 150, diastolicMmHg: 95, heartRateBpm: 0 } },
			{ subjectId: 'e1' },
		);
		expect(await screen.findByTestId('drafted-vitals')).toHaveProperty('textContent', 'BP 150/95 mmHg');
		expect(mocks.recordVitals).not.toHaveBeenCalled();
		click(/Save vitals/);
		await waitFor(() =>
			expect(mocks.recordVitals).toHaveBeenCalledWith({
				encounterId: 'e1',
				systolicMmHg: 150,
				diastolicMmHg: 95,
				wiseOrigin: origin('propose_vitals'),
			}),
		);
		await waitFor(() =>
			expect(mocks.queueOrSendMessage).toHaveBeenCalledWith({ text: 'I recorded the vitals: BP 150/95 mmHg.' }),
		);
	});

	it("refuses a visit that isn't the chat patient's", async () => {
		mocks.record = { ...record, encounter: { ...record.encounter, patientId: 'someone-else' } };
		renderCard(ProposeVitalsToolCall, 'propose_vitals', { encounterId: 'e1', vitals: {} }, { subjectId: 'e1' });
		expect(await screen.findByText(/isn't this patient's/)).toBeTruthy();
	});

	it('adds an allergy to the chart patient', async () => {
		renderCard(ProposeAllergyToolCall, 'propose_allergy', { allergen: 'Penicillin', reaction: 'Rash' });
		expect((await screen.findByTestId('drafted-allergy')).textContent).toContain('Penicillin');
		await waitFor(() =>
			expect(screen.getByRole('button', { name: /Add allergy/ })).toHaveProperty('disabled', false),
		);
		click(/Add allergy/);
		await waitFor(() =>
			expect(mocks.addAllergy).toHaveBeenCalledWith({
				patientId: 'p1',
				allergen: 'Penicillin',
				type: 'DRUG',
				reaction: 'Rash',
				severity: null,
				wiseOrigin: origin('propose_allergy'),
			}),
		);
	});

	it('removes a recorded allergy only with a reason and a second click', async () => {
		mocks.allergies = [{ id: 'a1', allergen: 'Penicillin', type: 'DRUG', reaction: 'Rash', severity: null }];
		renderCard(ProposeRemoveAllergyToolCall, 'propose_remove_allergy', { allergen: 'penicillin' });
		const confirm = await screen.findByRole('button', { name: /Remove allergy/ });
		expect(confirm).toHaveProperty('disabled', true);
		fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Entered in error' } });
		click(/Remove allergy/);
		expect(mocks.voidAllergy).not.toHaveBeenCalled();
		click(/Yes, remove allergy/);
		await waitFor(() =>
			expect(mocks.voidAllergy).toHaveBeenCalledWith({
				id: 'a1',
				reason: 'Entered in error',
				wiseOrigin: origin('propose_remove_allergy'),
			}),
		);
	});

	it('says so when the allergy to remove is not recorded', async () => {
		renderCard(ProposeRemoveAllergyToolCall, 'propose_remove_allergy', { allergen: 'Shrimp' });
		expect(await screen.findByText(/no recorded allergy to Shrimp/)).toBeTruthy();
	});
});
