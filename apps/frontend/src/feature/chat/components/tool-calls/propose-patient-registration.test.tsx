// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProposePatientRegistrationToolCall } from './propose-patient-registration';
import type { ToolCallComponentProps } from '.';

const mocks = vi.hoisted(() => ({
	register: vi.fn(),
	linkExisting: vi.fn(),
	queueOrSendMessage: vi.fn(),
	cancel: vi.fn(),
	outcomes: [] as unknown[],
	messages: [] as unknown[],
}));

vi.mock('@/lib/patient-api', () => {
	const mutation = (run: (input: unknown) => unknown) => ({
		mutationOptions: (options: object) => ({ mutationFn: (input: unknown) => run(input), ...options }),
	});
	return {
		patientApi: {
			patient: {
				search: { pathFilter: () => ({ queryKey: [['patient', 'search']] }) },
				register: mutation((input) => mocks.register(input)),
				linkExisting: mutation((input) => mocks.linkExisting(input)),
			},
		},
	};
});
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

const DRAFT = {
	givenName: 'Juan',
	familyName: 'Dela Cruz',
	birthDate: '1980-05-02',
	sex: 'MALE',
	philHealthId: '12-345678901-2',
};
const CLINICS = [{ id: 'c1', name: 'Tagbilaran City Health Center' }];
const PATIENT = {
	id: 'p-new',
	givenName: 'Juan',
	familyName: 'Dela Cruz',
	patientNo: 'TAG-PT-2026-000009',
	identifications: [{ id: 'i1', type: 'PHILHEALTH_ID', idNumber: '12-345678901-2', label: 'PhilHealth' }],
};
const MASKED = {
	patientId: 'p-old',
	match: 'NAME_BIRTH_SEX',
	visible: false,
	matchedOn: 'name, birth date and sex',
	displayName: 'J. D.',
	birthYear: 1980,
};

const renderCard = (output: object = {}, input: object = DRAFT) => {
	const toolPart = {
		type: 'tool-propose_patient_registration',
		toolCallId: 'call_1',
		state: 'output-available',
		input,
		output: { success: true, clinics: CLINICS, duplicates: [], ...output },
	} as unknown as ToolCallComponentProps<'propose_patient_registration'>['toolPart'];
	return render(
		<>
			<QueryClientProvider client={new QueryClient()}>
				<ProposePatientRegistrationToolCall toolPart={toolPart} />
			</QueryClientProvider>
		</>,
	);
};

const confirmButton = () => screen.getByRole('button', { name: /^Register/ }) as HTMLButtonElement;
const giveConsent = () => fireEvent.click(screen.getByLabelText('Consent'));

beforeEach(() => {
	vi.clearAllMocks();
	mocks.messages = [];
	mocks.outcomes = [];
	mocks.register.mockResolvedValue({ patient: PATIENT, duplicates: [] });
	mocks.linkExisting.mockResolvedValue(PATIENT);
});
afterEach(cleanup);

describe('ProposePatientRegistrationToolCall', () => {
	it('shows the draft and registers nothing until consent and Confirm', async () => {
		renderCard();
		expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
		expect(screen.getByText('12-345678901-2')).toBeTruthy();
		expect(screen.getByText('Assigned by the clinic')).toBeTruthy();
		expect(screen.getByText('Tagbilaran City Health Center')).toBeTruthy();
		expect(confirmButton().disabled).toBe(true);

		giveConsent();
		fireEvent.click(confirmButton());
		await waitFor(() =>
			expect(mocks.register).toHaveBeenCalledWith({
				clinicId: 'c1',
				givenName: 'Juan',
				middleName: null,
				familyName: 'Dela Cruz',
				birthDate: '1980-05-02',
				sex: 'MALE',
				phone: null,
				preferredLanguage: 'en',
				patientNo: null,
				philHealthId: '12-345678901-2',
				barangayCode: null,
				addressLine: null,
				consentGiven: true,
				acknowledgeDuplicates: false,
				wiseOrigin: {
					chatId: 'chat-1',
					toolCallId: 'call_1',
					toolName: 'propose_patient_registration',
					edited: false,
				},
			}),
		);
		await waitFor(() =>
			expect(mocks.queueOrSendMessage).toHaveBeenCalledWith({
				text: 'I registered Juan Dela Cruz (patient no. TAG-PT-2026-000009).',
			}),
		);
	});

	it('registers what the clinician edited', async () => {
		renderCard();
		fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
		fireEvent.change(screen.getByLabelText('Given name'), { target: { value: 'Juanito' } });
		giveConsent();
		fireEvent.click(confirmButton());
		await waitFor(() =>
			expect(mocks.register).toHaveBeenCalledWith(
				expect.objectContaining({
					givenName: 'Juanito',
					wiseOrigin: expect.objectContaining({ edited: true }),
				}),
			),
		);
	});

	it('opens the fields with the errors when the draft is incomplete', async () => {
		renderCard({}, { givenName: 'Juan', familyName: 'Dela Cruz' });
		giveConsent();
		fireEvent.click(confirmButton());
		expect(await screen.findByText('Choose the sex.')).toBeTruthy();
		expect(screen.getByLabelText('Given name')).toBeTruthy();
		expect(mocks.register).not.toHaveBeenCalled();
	});

	it('shows a masked duplicate and links the existing patient on request', async () => {
		renderCard({ duplicates: [MASKED] });
		expect(screen.getByText('J. D., born 1980')).toBeTruthy();
		expect(confirmButton().textContent).toContain('Register as new patient');

		giveConsent();
		fireEvent.click(screen.getByRole('button', { name: 'Use this patient' }));
		await waitFor(() =>
			expect(mocks.linkExisting).toHaveBeenCalledWith(
				expect.objectContaining({
					patientId: 'p-old',
					consentGiven: true,
					wiseOrigin: expect.objectContaining({
						toolCallId: 'call_1',
						toolName: 'propose_patient_registration',
					}),
				}),
			),
		);
		expect(mocks.register).not.toHaveBeenCalled();
	});

	it('cannot register over an identifier match', () => {
		renderCard({ duplicates: [{ ...MASKED, match: 'EXACT_IDENTIFIER', matchedOn: 'PhilHealth 12-345678901-2' }] });
		giveConsent();
		expect(confirmButton().disabled).toBe(true);
		expect(screen.getByText('This patient is already registered')).toBeTruthy();
	});

	it('shrinks to how it ended once answered', () => {
		mocks.messages = ['I registered Juan Dela Cruz (patient no. TAG-PT-2026-000009).'];
		renderCard();
		expect(screen.getByText('Registered')).toBeTruthy();
		expect(screen.queryByRole('button')).toBeNull();
	});
});
