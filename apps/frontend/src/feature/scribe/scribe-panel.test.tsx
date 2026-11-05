// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scribeDemoDraft } from '@loopwise/shared/scribe-demo';
import { ScribePanel } from './scribe-panel';
import type { ReactNode } from 'react';

const mocks = vi.hoisted(() => ({
	consent: null as unknown,
	agentSettings: { transcribe: { enabled: true } } as unknown,
	outcomes: [] as unknown[],
	messages: [] as unknown[],
	recordConsent: vi.fn(),
	updateNote: vi.fn(),
	recordVitals: vi.fn(),
	addDiagnosis: vi.fn(),
	savePrescription: vi.fn(),
	saveCertificate: vi.fn(),
	createOrder: vi.fn(),
	cancel: vi.fn(),
	queueOrSendMessage: vi.fn(),
	isRunning: false,
	query: (key: string, data: () => unknown) => ({
		queryOptions: (input?: object) => ({ queryKey: [key, input], queryFn: data }),
		pathFilter: () => ({ queryKey: [key] }),
	}),
	mutation: (fn: (input: unknown) => unknown) => ({
		mutationOptions: (options: object = {}) => ({ mutationFn: (input: unknown) => fn(input), ...options }),
	}),
}));

vi.mock('@/lib/scribe-api', () => ({
	scribeApi: {
		scribe: {
			consent: mocks.query('consent', () => mocks.consent),
			recordConsent: mocks.mutation((input) => mocks.recordConsent(input)),
		},
	},
	transcribeVisit: vi.fn(),
}));
vi.mock('@/lib/clinic-api', () => ({
	clinicApi: { clinic: { getAgentSettings: mocks.query('agentSettings', () => mocks.agentSettings) } },
}));
vi.mock('@/lib/encounter-record-api', () => ({
	encounterRecordApi: {
		encounterRecord: {
			get: mocks.query('record', () => null),
			updateNote: mocks.mutation((input) => mocks.updateNote(input)),
			recordVitals: mocks.mutation((input) => mocks.recordVitals(input)),
			addDiagnosis: mocks.mutation((input) => mocks.addDiagnosis(input)),
			savePrescription: mocks.mutation((input) => mocks.savePrescription(input)),
			saveCertificate: mocks.mutation((input) => mocks.saveCertificate(input)),
		},
	},
}));
vi.mock('@/lib/orders-api', () => ({
	ordersApi: { order: { create: mocks.mutation((input) => mocks.createOrder(input)) } },
}));
vi.mock('@/lib/encounter-api', () => ({
	encounterApi: { encounter: { list: { pathFilter: () => ({ queryKey: ['encounters'] }) } } },
}));
vi.mock('@/lib/patient-api', () => ({
	patientApi: { patient: { get: mocks.query('patient', () => ({ id: 'p1', preferredLanguage: 'ceb' })) } },
}));
vi.mock('@/lib/wise-proposal-api', () => ({
	wiseProposalApi: {
		wiseProposal: {
			outcomes: mocks.query('outcomes', () => mocks.outcomes),
			cancel: mocks.mutation((input) => mocks.cancel(input)),
		},
	},
}));
vi.mock('@/contexts/agent.provider', () => {
	const agent = () => ({
		queueOrSendMessage: mocks.queueOrSendMessage,
		isRunning: mocks.isRunning,
		chatId: 'chat-1',
		error: undefined,
	});
	return {
		useAgentContext: agent,
		useOptionalAgentContext: agent,
		useAgentMessagesSelector: (select: (messages: unknown[]) => unknown) => select(mocks.messages),
	};
});
vi.mock('@/feature/chat/components/tool-calls/clarification', () => ({ findAnswerForToolCall: () => null }));
vi.mock('@tanstack/react-router', () => ({ Link: ({ children }: { children: ReactNode }) => <a>{children}</a> }));

const record = {
	canEdit: true,
	encounter: {
		id: 'e1',
		encounterNo: 'TAG-ENC-2026-000042',
		patientId: 'p1',
		reason: 'BP check',
		history: null,
		reviewOfSystems: null,
		subjective: null,
		physicalExam: null,
		objective: null,
		assessment: null,
		plan: null,
		patientInstructions: null,
		followUpOn: null,
		disposition: null,
		notes: null,
		startedAt: '2026-11-06T01:00:00.000Z',
		version: 4,
	},
	vitals: [],
	diagnoses: [],
	allergies: [{ id: 'a1', allergen: 'Losartan', severity: 'MODERATE' }],
	prescriptions: [],
	medicalCertificates: [],
};

const output = {
	success: true,
	patientId: 'p1',
	encounter: {
		id: 'e1',
		encounterNo: 'TAG-ENC-2026-000042',
		startedAt: record.encounter.startedAt,
		clinicName: 'HC',
	},
	parts: [
		'soap',
		'vitals',
		'diagnosis-0',
		'diagnosis-1',
		'prescription',
		'orders',
		'certificate',
		'follow_up',
		'summary',
	],
	diagnoses: [
		{ icd10Code: 'I10', known: true, title: 'Essential (primary) hypertension' },
		{ icd10Code: 'E11.9', known: true, title: 'Non-insulin-dependent diabetes mellitus without complications' },
	],
	tests: {
		matched: [{ testId: 't1', code: 'HBA1C', name: 'Hemoglobin A1c (HbA1c)', category: 'LABORATORY' }],
		unmatched: ['serum creatinine'],
	},
	allergies: [{ allergen: 'Losartan', severity: 'MODERATE' }],
	allergyWarnings: [{ genericName: 'Losartan', allergen: 'Losartan' }],
};

const withDraft = () => {
	mocks.messages = [
		{
			id: 'm1',
			role: 'assistant',
			parts: [
				{
					type: 'tool-propose_scribe_note',
					toolCallId: 'call_1',
					state: 'output-available',
					input: scribeDemoDraft('e1'),
					output,
				},
			],
		},
	];
};

const renderPanel = () =>
	render(
		<MantineProvider>
			<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
				<ScribePanel record={record as never} />
			</QueryClientProvider>
		</MantineProvider>,
	);

const card = (part: string) => screen.getByTestId(`scribe-part-${part}`);
const origin = (part: string, edited = false) => ({
	chatId: 'chat-1',
	toolCallId: 'call_1',
	toolName: 'propose_scribe_note',
	part,
	edited,
});

beforeEach(() => {
	vi.clearAllMocks();
	mocks.consent = null;
	mocks.agentSettings = { transcribe: { enabled: true } };
	mocks.outcomes = [];
	mocks.messages = [];
	mocks.isRunning = false;
	for (const fn of [
		mocks.recordConsent,
		mocks.updateNote,
		mocks.recordVitals,
		mocks.addDiagnosis,
		mocks.savePrescription,
		mocks.saveCertificate,
		mocks.createOrder,
		mocks.cancel,
	]) {
		fn.mockResolvedValue({ id: 'x', version: 5 });
	}
	try {
		sessionStorage.clear();
	} catch {
		// jsdom always has it.
	}
});
afterEach(cleanup);

describe('AI scribe panel', () => {
	it('asks for the recording consent first, and lets the doctor type without it', async () => {
		renderPanel();
		await screen.findByTestId('scribe-consent-question');
		expect(screen.getByTestId('scribe-consent-status').textContent).toContain('Consent not asked yet');
		expect(screen.queryByRole('button', { name: /^Record$/ })).toBeNull();

		fireEvent.click(screen.getByRole('button', { name: 'Patient agrees' }));
		await waitFor(() => expect(mocks.recordConsent).toHaveBeenCalledWith({ encounterId: 'e1', granted: true }));

		const draft = screen.getByRole('button', { name: /Draft with Wise/ });
		expect((draft as HTMLButtonElement).disabled).toBe(true);
		fireEvent.change(screen.getByRole('textbox', { name: 'Transcript or dictation' }), {
			target: { value: 'BP 150/95. Continue metformin.' },
		});
		fireEvent.click(draft);
		const sent = mocks.queueOrSendMessage.mock.calls[0][0].text as string;
		expect(sent).toContain('propose_scribe_note');
		expect(sent).toContain('encounter e1');
		// Maria prefers Cebuano: the summary language follows.
		expect(sent).toContain('Cebuano (Bisaya)');
		expect(sent).toContain('BP 150/95. Continue metformin.');
	});

	it('keeps the record button off while the patient has declined', async () => {
		mocks.consent = { id: 'c1', granted: false, isActive: false, encounterId: 'e1' };
		renderPanel();
		expect((await screen.findByTestId('scribe-consent-status')).textContent).toContain(
			'Patient declined recording',
		);
		expect((screen.getByRole('button', { name: /Record/ }) as HTMLButtonElement).disabled).toBe(true);
		expect((screen.getByRole('button', { name: 'Ask for consent' }) as HTMLButtonElement).disabled).toBe(false);
	});

	it('keeps the record button off while the clinic has transcription off, and typing still works', async () => {
		mocks.consent = { id: 'c1', granted: true, isActive: true, encounterId: 'e1' };
		mocks.agentSettings = { transcribe: { enabled: false } };
		renderPanel();
		await waitFor(() =>
			expect(screen.getByTestId('scribe-recording-hint').textContent).toBe(
				'Transcription is off for this clinic. Turn it on in Settings → Clinic → Agent, or type the dictation.',
			),
		);
		expect((screen.getByRole('button', { name: /Record/ }) as HTMLButtonElement).disabled).toBe(true);
		fireEvent.change(screen.getByRole('textbox', { name: 'Transcript or dictation' }), {
			target: { value: 'BP 150/95.' },
		});
		expect((screen.getByRole('button', { name: /Draft with Wise/ }) as HTMLButtonElement).disabled).toBe(false);
	});

	it('turns the record button on with consent and transcription on', async () => {
		mocks.consent = { id: 'c1', granted: true, isActive: true, encounterId: 'e1' };
		renderPanel();
		await waitFor(() =>
			expect((screen.getByRole('button', { name: /Record/ }) as HTMLButtonElement).disabled).toBe(false),
		);
		expect(screen.getByTestId('scribe-recording-hint').textContent).toContain('the audio is not kept');
	});

	it('shows one card per part and saves nothing until a card is confirmed', async () => {
		mocks.consent = { id: 'c1', granted: true, isActive: true, encounterId: 'e1' };
		withDraft();
		renderPanel();
		await screen.findByTestId('scribe-cards');
		for (const part of output.parts) {
			expect(card(part)).toBeTruthy();
		}
		expect((await screen.findByTestId('scribe-progress')).textContent).toContain('0 of 9 saved · 9 to review');
		for (const fn of [mocks.updateNote, mocks.recordVitals, mocks.addDiagnosis, mocks.savePrescription]) {
			expect(fn).not.toHaveBeenCalled();
		}

		// The prescription shows the allergies and warns on the match.
		expect(within(card('prescription')).getByTestId('scribe-allergies').textContent).toContain(
			'Losartan (moderate)',
		);
		expect(within(card('prescription')).getByRole('alert').textContent).toContain('Losartan (allergy: Losartan)');
		// Tests the clinic's catalog lacks are named, not ordered.
		expect(card('orders').textContent).toContain('serum creatinine');
	});

	it('confirms a part through its own mutation with the part in the origin', async () => {
		mocks.consent = { id: 'c1', granted: true, isActive: true, encounterId: 'e1' };
		withDraft();
		renderPanel();
		await screen.findByTestId('scribe-cards');

		fireEvent.click(within(card('soap')).getByRole('button', { name: 'Save note' }));
		await waitFor(() => expect(mocks.updateNote).toHaveBeenCalledTimes(1));
		expect(mocks.updateNote.mock.calls[0][0]).toMatchObject({
			encounterId: 'e1',
			reason: 'Follow-up of hypertension and diabetes; afternoon headaches',
			subjective: 'Adherent to metformin; misses amlodipine doses at times.',
			objective: 'CBG 182 mg/dL. HbA1c 7.2% at the last visit.',
			expectedVersion: 4,
			wiseOrigin: origin('soap'),
		});

		fireEvent.click(within(card('vitals')).getByRole('button', { name: 'Save vitals' }));
		await waitFor(() =>
			expect(mocks.recordVitals).toHaveBeenCalledWith(
				expect.objectContaining({ systolicMmHg: 150, diastolicMmHg: 95, wiseOrigin: origin('vitals') }),
			),
		);

		fireEvent.click(within(card('diagnosis-0')).getByRole('button', { name: 'Add diagnosis' }));
		await waitFor(() =>
			expect(mocks.addDiagnosis).toHaveBeenCalledWith(
				expect.objectContaining({ icd10Code: 'I10', type: 'PRIMARY', wiseOrigin: origin('diagnosis-0') }),
			),
		);

		fireEvent.click(within(card('orders')).getByRole('button', { name: 'Order test' }));
		await waitFor(() =>
			expect(mocks.createOrder).toHaveBeenCalledWith(
				expect.objectContaining({ testIds: ['t1'], wiseOrigin: origin('orders') }),
			),
		);
	});

	it('dismisses one part without touching the others, and shows how each ended after a reload', async () => {
		mocks.consent = { id: 'c1', granted: true, isActive: true, encounterId: 'e1' };
		withDraft();
		renderPanel();
		await screen.findByTestId('scribe-cards');
		fireEvent.click(within(card('summary')).getByRole('button', { name: 'Dismiss' }));
		await waitFor(() => expect(mocks.cancel).toHaveBeenCalledWith({ ...origin('summary'), edited: false }));
		expect(mocks.queueOrSendMessage).not.toHaveBeenCalled();
		cleanup();

		mocks.outcomes = [
			{ toolCallId: 'call_1#soap', toolName: 'propose_scribe_note', status: 'confirmed', edited: true },
			{ toolCallId: 'call_1#summary', toolName: 'propose_scribe_note', status: 'cancelled', edited: false },
		];
		renderPanel();
		await waitFor(() => expect(card('soap').getAttribute('data-settled')).toBe('confirmed'));
		expect(card('soap').textContent).toContain('Saved · edited');
		expect(card('summary').textContent).toContain('Dismissed');
		expect(card('vitals').getAttribute('data-settled')).toBeNull();
		expect(screen.getByTestId('scribe-progress').textContent).toContain('1 of 9 saved (1 edited) · 1 dismissed');
	});
});
