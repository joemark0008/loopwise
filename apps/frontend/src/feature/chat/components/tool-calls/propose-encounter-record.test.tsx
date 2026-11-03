// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	ProposeChargesToolCall,
	ProposeMedicalCertificateToolCall,
	ProposePrescriptionToolCall,
} from './propose-encounter-record';
import type { ReactNode } from 'react';

const mocks = vi.hoisted(() => ({
	record: null as unknown,
	savePrescription: vi.fn(),
	saveCertificate: vi.fn(),
	saveBill: vi.fn(),
	queueOrSendMessage: vi.fn(),
	cancel: vi.fn(),
	outcomes: [] as unknown[],
	messages: [] as unknown[],
	mutation: (fn: (input: unknown) => unknown) => ({
		mutationOptions: (options: object) => ({ mutationFn: (input: unknown) => fn(input), ...options }),
	}),
}));

vi.mock('@/lib/encounter-record-api', () => ({
	encounterRecordApi: {
		encounterRecord: {
			get: {
				queryOptions: (input: { encounterId: string }) => ({
					queryKey: ['record', input.encounterId],
					queryFn: () => mocks.record,
				}),
				pathFilter: () => ({ queryKey: ['record'] }),
			},
			savePrescription: mocks.mutation((input) => mocks.savePrescription(input)),
			saveCertificate: mocks.mutation((input) => mocks.saveCertificate(input)),
			saveBill: mocks.mutation((input) => mocks.saveBill(input)),
		},
	},
}));
vi.mock('@/lib/encounter-api', () => ({
	encounterApi: { encounter: { list: { pathFilter: () => ({ queryKey: ['encounters'] }) } } },
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
vi.mock('@tanstack/react-router', () => ({ Link: ({ children }: { children: ReactNode }) => <a>{children}</a> }));

const record = (overrides: object = {}) => ({
	canEdit: true,
	encounter: {
		id: 'e1',
		patientId: 'p1',
		reason: 'Fatigue',
		notes: null,
		history: 'Old history',
		physicalExam: null,
		assessment: null,
		plan: null,
		patientInstructions: null,
		followUpOn: null,
		startedAt: '2026-11-03T01:00:00.000Z',
	},
	vitals: [],
	diagnoses: [],
	allergies: [{ id: 'a1', substance: 'Penicillin' }],
	orders: [{ code: '4548-4' }],
	prescriptions: [],
	medicalCertificates: [],
	bills: [],
	...overrides,
});

const renderCard = (Card: React.ComponentType<any>, type: string, input: object) => {
	const toolPart = {
		type: `tool-${type}`,
		toolCallId: 'call_1',
		state: 'output-available',
		input: { encounterId: 'e1', ...input },
		output: { success: true, patientId: 'p1', encounterId: 'e1' },
	};
	return render(
		<MantineProvider>
			<QueryClientProvider client={new QueryClient()}>
				<Card toolPart={toolPart} />
			</QueryClientProvider>
		</MantineProvider>,
	);
};

beforeEach(() => {
	vi.clearAllMocks();
	mocks.messages = [];
	mocks.outcomes = [];
	mocks.record = record();
	mocks.savePrescription.mockResolvedValue({ id: 'rx1' });
	mocks.saveCertificate.mockResolvedValue({ id: 'mc1' });
	mocks.saveBill.mockResolvedValue({ id: 'b1' });
});
afterEach(cleanup);

describe('encounter-record proposal cards', () => {
	it('drafts a prescription, warns about an allergy, and saves only a draft', async () => {
		renderCard(ProposePrescriptionToolCall, 'propose_prescription', {
			items: [
				{
					genericName: 'Amoxicillin',
					strength: '500 mg',
					dose: '1 capsule',
					frequency: 'three times a day',
					quantity: 21,
				},
			],
		});
		expect(await screen.findByRole('alert')).toHaveProperty(
			'textContent',
			'Allergy warning: Amoxicillin (allergy: Penicillin)',
		);
		expect(mocks.savePrescription).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole('button', { name: /Save draft prescription/ }));
		await waitFor(() =>
			expect(mocks.savePrescription).toHaveBeenCalledWith(
				expect.objectContaining({
					id: null,
					encounterId: 'e1',
					items: [expect.objectContaining({ genericName: 'Amoxicillin', quantity: 21 })],
					expectedVersion: null,
					wiseOrigin: {
						chatId: 'chat-1',
						toolCallId: 'call_1',
						toolName: 'propose_prescription',
						edited: false,
					},
				}),
			),
		);
		await waitFor(() =>
			expect(mocks.queueOrSendMessage).toHaveBeenCalledWith({
				text: 'I saved the prescription draft: Amoxicillin.',
			}),
		);
	});

	it("refuses an encounter that isn't the chat patient's", async () => {
		mocks.record = record({ encounter: { ...record().encounter, patientId: 'someone-else' } });
		renderCard(ProposePrescriptionToolCall, 'propose_prescription', { items: [] });
		expect(await screen.findByText(/isn't this patient's/)).toBeTruthy();
	});

	it('shows a prescription that replaces the draft on the visit as before → after, saved against its version', async () => {
		mocks.record = record({
			prescriptions: [
				{
					id: 'rx0',
					version: 3,
					status: 'draft',
					notes: null,
					items: [
						{
							genericName: 'Amlodipine',
							brandName: null,
							strength: '5 mg',
							form: 'tablet',
							dose: '1 tablet',
							route: 'oral',
							frequency: 'once a day',
							durationDays: 30,
							quantity: 30,
						},
					],
				},
			],
		});
		renderCard(ProposePrescriptionToolCall, 'propose_prescription', {
			items: [
				{
					genericName: 'Amlodipine',
					strength: '10 mg',
					form: 'tablet',
					dose: '1 tablet',
					frequency: 'once a day',
					durationDays: 30,
					quantity: 30,
				},
			],
		});
		const medicines = await screen.findByTestId('proposal-diff-medicines');
		expect(medicines.textContent).toContain('Amlodipine 5 mg tablet');
		expect(medicines.textContent).toContain('Amlodipine 10 mg tablet');
		expect(screen.getByTestId('proposal-target').textContent).toContain('replaces the draft on this visit');
		fireEvent.click(screen.getByRole('button', { name: /Save draft prescription/ }));
		await waitFor(() =>
			expect(mocks.savePrescription).toHaveBeenCalledWith(
				expect.objectContaining({ id: 'rx0', expectedVersion: 3 }),
			),
		);
	});

	it('offers a new draft when the prescription changed since the card showed it', async () => {
		mocks.savePrescription.mockRejectedValue(
			new Error(
				'This prescription was changed after this edit was drafted. Ask Wise to re-draft it from the current prescription.',
			),
		);
		renderCard(ProposePrescriptionToolCall, 'propose_prescription', {
			items: [
				{
					genericName: 'Metformin',
					strength: '500 mg',
					dose: '1 tablet',
					frequency: 'twice a day',
					quantity: 60,
				},
			],
		});
		fireEvent.click(await screen.findByRole('button', { name: /Save draft prescription/ }));
		expect(await screen.findByRole('button', { name: 'Re-draft' })).toBeTruthy();
		expect((screen.getByRole('button', { name: /Save draft prescription/ }) as HTMLButtonElement).disabled).toBe(
			true,
		);
	});

	it('saves a certificate draft with the card origin', async () => {
		renderCard(ProposeMedicalCertificateToolCall, 'propose_medical_certificate', {
			diagnosisText: 'Hypertension',
			restDays: 2,
		});
		fireEvent.click(await screen.findByRole('button', { name: /Save draft certificate/ }));
		await waitFor(() =>
			expect(mocks.saveCertificate).toHaveBeenCalledWith(
				expect.objectContaining({
					diagnosisText: 'Hypertension',
					restDays: 2,
					expectedVersion: null,
					wiseOrigin: expect.objectContaining({ toolName: 'propose_medical_certificate' }),
				}),
			),
		);
	});

	it('starts a bill from the fee schedule and totals the senior discount', async () => {
		renderCard(ProposeChargesToolCall, 'propose_charges', { discountKind: 'senior_citizen' });
		expect(await screen.findByText('₱520.00')).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: /Save draft bill/ }));
		await waitFor(() =>
			expect(mocks.saveBill).toHaveBeenCalledWith(
				expect.objectContaining({
					discountKind: 'senior_citizen',
					charges: [
						expect.objectContaining({ code: 'CONSULT' }),
						expect.objectContaining({ code: '4548-4' }),
					],
					wiseOrigin: expect.objectContaining({ toolName: 'propose_charges' }),
				}),
			),
		);
	});

	it('shrinks to how it ended once answered', async () => {
		mocks.messages = ['I saved the bill draft: ₱520.00.'];
		renderCard(ProposeChargesToolCall, 'propose_charges', {});
		expect(await screen.findByText('Saved as draft')).toBeTruthy();
	});
});
