import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { SCRIBE_DEMO_TRANSCRIPT, scribeDemoDraft } from '../../shared/src/scribe-demo';
import { withDatabase } from './db';
import { USER, logIn, trackErrors } from './helpers';
import type { Page } from '@playwright/test';

/**
 * The AI scribe (DESIGN.md §7.5) on a new visit of Maria Santos (synthetic): recording needs the patient's consent for
 * the visit, typing never does, and Wise's one-pass draft comes back as cards the doctor confirms one by one.
 */
async function openNewVisit(page: Page, reason: string) {
	await page.getByLabel('Search patients').fill('Maria Santos');
	await page
		.getByTestId('patient-list')
		.getByRole('link', { name: /Maria Santos/ })
		.click();
	await expect(page.getByTestId('patient-name')).toHaveText('Maria Santos');
	await page.getByRole('button', { name: 'New encounter' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Chief complaint').fill(reason);
	await dialog.getByRole('button', { name: 'Save encounter' }).click();
	await expect(dialog).toBeHidden();
	await page
		.getByTestId('encounter-list')
		.getByRole('link', { name: new RegExp(reason) })
		.click();
	await expect(page.getByTestId('encounter-title')).toContainText(reason);
	await page.getByRole('tab', { name: 'AI scribe' }).click();
	await expect(page.getByTestId('scribe-panel')).toBeVisible();
}

/** Turns the clinic's Transcription switch on or off as the signed-in admin; returns whether it was on. */
async function setTranscription(page: Page, enabled: boolean): Promise<boolean> {
	const graphql = async (query: string, variables: object = {}) => {
		const response = await page.request.post('/graphql', { data: { query, variables } });
		const body = await response.json();
		expect(body.errors).toBeUndefined();
		return body.data;
	};
	const { agentSettings } = await graphql('{ agentSettings }');
	await graphql('mutation ($input: JSON!) { updateAgentSettings(input: $input) }', {
		input: { transcribe: { ...agentSettings?.transcribe, enabled } },
	});
	return agentSettings?.transcribe?.enabled ?? false;
}

/**
 * Puts a finished `propose_scribe_note` call for the open visit (SOAP and patient summary parts) in the user's chart
 * chat, as Wise's saved reply would be, without an LLM call; then reloads so the AI scribe tab shows its cards.
 */
async function insertScribeDraft(page: Page) {
	const [, patientId, encounterId] = new URL(page.url()).pathname.match(/\/patients\/([^/]+)\/encounters\/([^/]+)/)!;
	const chat = await page.request.post('/graphql', {
		data: { query: 'query ($id: ID!) { patientChat(patientId: $id) }', variables: { id: patientId } },
	});
	const existingChatId: string | null = (await chat.json()).data.patientChat;
	const { soap, patientSummary } = scribeDemoDraft(encounterId);
	await withDatabase(async (db) => {
		const {
			rows: [visit],
		} = await db.query(
			`SELECT e.encounter_no, e.started_at, e.clinic_id, c.name AS clinic_name, u.id AS user_id
			 FROM encounters e JOIN clinics c ON c.id = e.clinic_id, users u WHERE e.id = $1 AND u.email = $2`,
			[encounterId, USER.email],
		);
		const chatId = existingChatId ?? randomUUID();
		if (!existingChatId) {
			await db.query(
				`INSERT INTO chats (id, user_id, clinic_id, surface, patient_id, title, updated_at)
				 VALUES ($1, $2, $3, 'patient', $4, 'Scribe e2e', now())`,
				[chatId, visit.user_id, visit.clinic_id, patientId],
			);
		}
		const messageId = randomUUID();
		await db.query(
			`INSERT INTO chat_messages (id, chat_id, role, stop_reason) VALUES ($1, $2, 'assistant', 'stop')`,
			[messageId, chatId],
		);
		const output = {
			success: true,
			patientId,
			encounter: {
				id: encounterId,
				encounterNo: visit.encounter_no,
				startedAt: new Date(visit.started_at).toISOString(),
				clinicName: visit.clinic_name,
			},
			parts: ['soap', 'summary'],
			diagnoses: [],
			tests: { matched: [], unmatched: [] },
			allergies: [],
			allergyWarnings: [],
		};
		await db.query(
			`INSERT INTO message_parts (id, message_id, "order", type, tool_call_id, tool_name, tool_state, tool_input, tool_output)
			 VALUES ($1, $2, 0, 'tool-propose_scribe_note', $3, 'propose_scribe_note', 'output-available', $4, $5)`,
			[
				randomUUID(),
				messageId,
				`call_e2e_${randomUUID()}`,
				JSON.stringify({ encounterId, soap, patientSummary }),
				JSON.stringify(output),
			],
		);
	});
	await page.reload();
}

test.describe('AI scribe', () => {
	test.beforeEach(async ({ page }) => {
		await logIn(page, '/patients');
	});

	test('asks for recording consent per visit; without it recording stays off and typing works', async ({ page }) => {
		const errors = trackErrors(page);
		await openNewVisit(page, `Scribe consent ${Date.now().toString(36)}`);
		const panel = page.getByTestId('scribe-panel');
		const status = panel.getByTestId('scribe-consent-status');

		await expect(status).toHaveText('Consent not asked yet');
		await expect(panel.getByTestId('scribe-consent-question')).toContainText('not kept');
		await expect(panel.getByRole('button', { name: 'Record' })).toHaveCount(0);

		await panel.getByRole('button', { name: 'Patient declines' }).click();
		await expect(status).toHaveText('Patient declined recording');
		await expect(panel.getByRole('button', { name: 'Record' })).toBeDisabled();

		// Typing a dictation needs no consent.
		const draft = panel.getByRole('button', { name: 'Draft with Wise' });
		await expect(draft).toBeDisabled();
		await panel.getByRole('textbox', { name: 'Transcript or dictation' }).fill('BP 150/95. Continue metformin.');
		await expect(draft).toBeEnabled();
		// Maria prefers Cebuano: the summary follows her language.
		await expect(panel.getByLabel('Patient summary in')).toHaveValue('ceb');

		// The clinic's Transcription switch (Settings → Clinic → Agent) has to be on too; it is put back at the end.
		const transcriptionWasOn = await setTranscription(page, false);
		try {
			await page.reload();
			await panel.getByRole('button', { name: 'Ask for consent' }).click();
			await panel.getByRole('button', { name: 'Patient agrees' }).click();
			await expect(status).toHaveText('Consent to record given');
			await expect(panel.getByTestId('scribe-recording-hint')).toHaveText(
				'Transcription is off for this clinic. Turn it on in Settings → Clinic → Agent, or type the dictation.',
			);
			await expect(panel.getByRole('button', { name: 'Record' })).toBeDisabled();
			await expect(draft).toBeEnabled();

			await setTranscription(page, true);
			await page.reload();
			await expect(panel.getByRole('button', { name: 'Record' })).toBeEnabled();
		} finally {
			await setTranscription(page, transcriptionWasOn);
		}

		// The answer is the visit's: it is there after a reload, and so is the typed dictation.
		await page.reload();
		await expect(page.getByTestId('scribe-consent-status')).toHaveText('Consent to record given');
		await expect(page.getByRole('textbox', { name: 'Transcript or dictation' })).toHaveValue(
			'BP 150/95. Continue metformin.',
		);
		expect(errors).toEqual([]);
	});

	test('confirms and dismisses parts of a scribe draft from the AI scribe tab', async ({ page }) => {
		const errors = trackErrors(page);
		await openNewVisit(page, `Scribe cards ${Date.now().toString(36)}`);
		await insertScribeDraft(page);

		const panel = page.getByTestId('scribe-panel');
		const cards = panel.getByTestId('scribe-cards');
		await expect(panel.getByTestId('scribe-progress')).toContainText('0 of 2 saved');
		const soap = cards.getByTestId('scribe-part-soap');
		await expect(soap).toContainText('Changes an existing record');
		await soap.getByRole('button', { name: 'Save note' }).click();
		await expect(soap).toContainText('Saved');

		const summary = cards.getByTestId('scribe-part-summary');
		await summary.getByRole('button', { name: 'Dismiss' }).click();
		await expect(summary).toContainText('Dismissed');
		await expect(panel.getByTestId('scribe-progress')).toContainText('1 of 2 saved · 1 dismissed');

		await page.getByRole('tab', { name: /Note & diagnosis/ }).click();
		await expect(page.getByRole('textbox', { name: 'Assessment (A)' })).toHaveValue(/hypertension/i);

		// Settled once: after a reload the cards say how they ended.
		await page.getByRole('tab', { name: 'AI scribe' }).click();
		await page.reload();
		await expect(page.getByTestId('scribe-part-soap')).toContainText('Saved');
		await expect(page.getByTestId('scribe-part-summary')).toContainText('Dismissed');
		expect(errors).toEqual([]);
	});

	test('drafts the whole visit as cards, saves only what the doctor confirms, and keeps them settled (real LLM call)', async ({
		page,
	}) => {
		test.setTimeout(240_000);
		const errors = trackErrors(page);
		await openNewVisit(page, `Scribe follow-up ${Date.now().toString(36)}`);
		const panel = page.getByTestId('scribe-panel');

		await panel.getByRole('textbox', { name: 'Transcript or dictation' }).fill(SCRIBE_DEMO_TRANSCRIPT);
		await panel.getByRole('button', { name: 'Draft with Wise' }).click();

		const cards = panel.getByTestId('scribe-cards');
		await expect(cards).toBeVisible({ timeout: 180_000 });
		await expect(panel.getByTestId('scribe-progress')).toContainText('0 of');
		for (const part of ['soap', 'vitals', 'prescription', 'follow_up', 'summary']) {
			await expect(cards.getByTestId(`scribe-part-${part}`)).toBeVisible();
		}
		await expect(cards.getByTestId(/^scribe-part-diagnosis-/).first()).toBeVisible();
		await expect(cards.getByTestId('scribe-part-prescription').getByTestId('scribe-allergies')).toContainText(
			'Allergies:',
		);
		await expect(cards.getByTestId('scribe-part-prescription')).toContainText(/Metformin/i);

		// Nothing is saved before a Confirm: the note still has only the chief complaint.
		const soap = cards.getByTestId('scribe-part-soap');
		await expect(soap).toContainText('Changes an existing record');
		await soap.getByRole('button', { name: 'Save note' }).click();
		await expect(soap).toContainText('Saved');

		const summary = cards.getByTestId('scribe-part-summary');
		await summary.getByRole('button', { name: 'Dismiss' }).click();
		await expect(summary).toContainText('Dismissed');
		await expect(panel.getByTestId('scribe-progress')).toContainText('1 dismissed');

		await page.getByRole('tab', { name: /Note & diagnosis/ }).click();
		await expect(page.getByRole('textbox', { name: 'Assessment (A)' })).toHaveValue(/hypertension/i);
		await expect(page.getByRole('textbox', { name: 'Instructions to the patient' })).toHaveValue('');

		await page.getByRole('tab', { name: 'AI scribe' }).click();
		await page.reload();
		await expect(page.getByTestId('scribe-part-soap')).toContainText('Saved', { timeout: 30_000 });
		await expect(page.getByTestId('scribe-part-summary')).toContainText('Dismissed');
		await expect(page.getByTestId('scribe-part-vitals').getByRole('button', { name: 'Save vitals' })).toBeVisible();
		expect(errors).toEqual([]);
	});
});
