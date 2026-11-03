// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	ProposeBillStepToolCall,
	ProposeDiagnosisToolCall,
	ProposeIssueDocumentToolCall,
	ProposeLabOrderStepToolCall,
	ProposePatientUpdateToolCall,
} from './propose-record-actions';
import type { ReactNode } from 'react';

const mocks = vi.hoisted(() => ({
	record: null as unknown,
	labOrders: { sent: [] as unknown[], accepted: [] as unknown[] },
	contact: null as unknown,
	calls: {} as Record<string, ReturnType<typeof vi.fn>>,
	queueOrSendMessage: vi.fn(),
	query: (key: string, data: (input?: Record<string, unknown>) => unknown) => ({
		queryOptions: (input?: Record<string, unknown>) => ({ queryKey: [key, input], queryFn: () => data(input) }),
		pathFilter: () => ({ queryKey: [key] }),
	}),
	call: (name: string) => {
		const fn = vi.fn().mockResolvedValue({ id: 'x' });
		mocks.calls[name] = fn;
		return {
			mutate: (input: unknown) => fn(input),
			mutationOptions: (options: object) => ({ mutationFn: (input: unknown) => fn(input), ...options }),
		};
	},
}));

vi.mock('@/lib/encounter-record-api', () => ({
	encounterRecordApi: {
		encounterRecord: {
			get: mocks.query('record', () => mocks.record),
			addDiagnosis: mocks.call('addDiagnosis'),
			updateDiagnosis: mocks.call('updateDiagnosis'),
			voidDiagnosis: mocks.call('voidDiagnosis'),
			voidVitals: mocks.call('voidVitals'),
			voidPrescription: mocks.call('voidPrescription'),
			voidCertificate: mocks.call('voidCertificate'),
			markBillPaid: mocks.call('markBillPaid'),
			voidBill: mocks.call('voidBill'),
		},
	},
}));
vi.mock('@/lib/orders-api', () => ({
	ordersApi: {
		order: {
			labOrders: mocks.query('labOrders', (input) => mocks.labOrders[input?.status as 'sent' | 'accepted']),
			reject: mocks.call('reject'),
			cancel: mocks.call('cancel'),
		},
	},
}));
vi.mock('@/lib/wise-actions-api', () => ({
	wiseActionsApi: {
		patientContact: mocks.query('contact', () => mocks.contact),
		issuePrescription: mocks.call('issuePrescription'),
		issueCertificate: mocks.call('issueCertificate'),
		finalizeBill: mocks.call('finalizeBill'),
		acceptOrder: mocks.call('acceptOrder'),
		markOrderCollected: mocks.call('markOrderCollected'),
		saveReportToChart: mocks.call('saveReportToChart'),
		updatePatient: mocks.call('updatePatient'),
	},
}));
vi.mock('@/lib/encounter-api', () => ({
	encounterApi: { encounter: { list: { pathFilter: () => ({ queryKey: ['encounters'] }) } } },
}));
vi.mock('@/contexts/agent.provider', () => ({
	useAgentContext: () => ({ queueOrSendMessage: mocks.queueOrSendMessage, isRunning: false, chatId: 'chat-1' }),
	useAgentMessagesSelector: (select: (messages: unknown[]) => unknown) => select([]),
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

const record = (overrides: object = {}) => ({
	canEdit: true,
	encounter: { id: 'e1', patientId: 'p1', reason: 'BP check', startedAt: '2026-11-03T01:00:00.000Z' },
	vitals: [],
	diagnoses: [],
	orders: [],
	prescriptions: [],
	medicalCertificates: [],
	bills: [],
	...overrides,
});

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
						output: { success: true, patientId: 'p1', subjectId: 'e1', ...output },
					}}
				/>
			</QueryClientProvider>
		</MantineProvider>,
	);

const button = (name: RegExp) => screen.findByRole('button', { name });

beforeEach(() => {
	vi.clearAllMocks();
	mocks.record = record();
	mocks.labOrders = { sent: [], accepted: [] };
	mocks.contact = null;
	for (const fn of Object.values(mocks.calls)) {
		fn.mockResolvedValue({ id: 'x' });
	}
});
afterEach(cleanup);

describe('Wise record action cards', () => {
	it('changes the diagnosis the visit already has with that code instead of adding a second one', async () => {
		mocks.record = record({
			diagnoses: [
				{
					id: 'd1',
					icd10Code: 'I10',
					display: 'Hypertension',
					certainty: 'provisional',
					isPrimary: true,
					notes: null,
					voidedAt: null,
				},
			],
		});
		renderCard(ProposeDiagnosisToolCall, 'propose_diagnosis', {
			encounterId: 'e1',
			icd10Code: 'i10',
			display: 'Hypertension',
			certainty: 'confirmed',
		});
		fireEvent.click(await button(/Save changes/));
		await waitFor(() =>
			expect(mocks.calls.updateDiagnosis).toHaveBeenCalledWith({
				id: 'd1',
				certainty: 'confirmed',
				isPrimary: true,
				notes: null,
				wiseOrigin: origin('propose_diagnosis'),
			}),
		);
		expect(mocks.calls.addDiagnosis).not.toHaveBeenCalled();
	});

	it('issues a draft prescription only after a second click', async () => {
		mocks.record = record({
			prescriptions: [
				{
					id: 'rx1',
					status: 'draft',
					createdAt: '2026-11-03T02:00:00.000Z',
					items: [{ id: 'i1', genericName: 'Amlodipine', brandName: null, strength: '5 mg', form: 'tablet' }],
				},
			],
		});
		renderCard(ProposeIssueDocumentToolCall, 'propose_issue_document', {
			encounterId: 'e1',
			document: 'prescription',
		});
		expect((await screen.findByTestId('issue-items')).textContent).toContain('Amlodipine');
		fireEvent.click(await button(/^Issue prescription$/));
		expect(mocks.calls.issuePrescription).not.toHaveBeenCalled();
		fireEvent.click(await button(/Yes, issue prescription/));
		await waitFor(() =>
			expect(mocks.calls.issuePrescription).toHaveBeenCalledWith({
				id: 'rx1',
				wiseOrigin: origin('propose_issue_document'),
			}),
		);
	});

	it('says when there is no draft to issue', async () => {
		renderCard(ProposeIssueDocumentToolCall, 'propose_issue_document', {
			encounterId: 'e1',
			document: 'medical_certificate',
		});
		expect(await screen.findByText(/no draft medical certificate to issue/)).toBeTruthy();
	});

	it('marks the bill paid only with the OR number', async () => {
		mocks.record = record({ bills: [{ id: 'b1', status: 'finalized', total: 300, charges: [{ id: 'c1' }] }] });
		renderCard(ProposeBillStepToolCall, 'propose_bill_step', { encounterId: 'e1', step: 'pay' });
		const confirm = await button(/Mark paid/);
		expect(confirm).toHaveProperty('disabled', true);
		fireEvent.change(screen.getByLabelText(/Official receipt/), { target: { value: 'OR-1001' } });
		fireEvent.click(confirm);
		await waitFor(() =>
			expect(mocks.calls.markBillPaid).toHaveBeenCalledWith({
				id: 'b1',
				orNumber: 'OR-1001',
				wiseOrigin: origin('propose_bill_step', true),
			}),
		);
	});

	it('rejects an order on the worklist only with a reason and a second click', async () => {
		mocks.labOrders.sent = [
			{
				id: 'o1',
				code: '1558-6',
				display: 'Fasting glucose',
				priority: 'stat',
				patient: { givenName: 'Maria', familyName: 'Santos' },
				orderingDoctorName: 'Dr. Reyes',
				orderingFacilityName: 'Health Center',
			},
		];
		renderCard(
			ProposeLabOrderStepToolCall,
			'propose_lab_order_step',
			{ orderId: 'o1', step: 'reject' },
			{ patientId: undefined, subjectId: 'o1' },
		);
		const confirm = await button(/Reject order/);
		expect(confirm).toHaveProperty('disabled', true);
		fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Patient not fasting' } });
		fireEvent.click(confirm);
		fireEvent.click(await button(/Yes, reject order/));
		await waitFor(() =>
			expect(mocks.calls.reject).toHaveBeenCalledWith({
				orderId: 'o1',
				reason: 'Patient not fasting',
				wiseOrigin: origin('propose_lab_order_step'),
			}),
		);
	});

	it('changes only the contact details that differ, showing the current value', async () => {
		mocks.contact = {
			id: 'p1',
			givenName: 'Maria',
			familyName: 'Santos',
			phone: '0917 000 0000',
			preferredLanguage: 'Cebuano',
			barangay: 'Cogon',
		};
		renderCard(
			ProposePatientUpdateToolCall,
			'propose_patient_update',
			{ phone: '0917 555 0100', barangay: 'Cogon' },
			{ subjectId: undefined },
		);
		expect((await screen.findByTestId('contact-before-phone')).textContent).toBe('Before: 0917 000 0000');
		fireEvent.click(await button(/Save changes/));
		await waitFor(() =>
			expect(mocks.calls.updatePatient).toHaveBeenCalledWith({
				patientId: 'p1',
				phone: '0917 555 0100',
				wiseOrigin: origin('propose_patient_update'),
			}),
		);
	});
});
