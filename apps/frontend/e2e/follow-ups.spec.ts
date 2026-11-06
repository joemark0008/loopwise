import { expect, test } from '@playwright/test';
import { DOCTOR, logIn, trackErrors, USER } from './helpers';
import type { Browser, Page } from '@playwright/test';

/** Seeded logins at TAG (synthetic): the front desk and the internist (Dr. Cruz). */
const FRONT_DESK = { email: 'front.desk@loopwise.test', password: 'test1234' };
const INTERNIST = { email: 'dr.cruz@loopwise.test', password: 'test1234' };

async function signedIn(browser: Browser, path: string, user: { email: string; password: string }): Promise<Page> {
	const page = await (await browser.newContext()).newPage();
	await logIn(page, path, user);
	return page;
}

/** A GraphQL call with the page's session (the signed-in user). */
async function gql<T>(page: Page, query: string, variables: Record<string, unknown>): Promise<T> {
	const res = await page.request.post('/graphql', { data: { query, variables } });
	const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
	expect(body.errors, JSON.stringify(body.errors)).toBeUndefined();
	return body.data!;
}

/** The YYYY-MM-DD of tomorrow in Manila. */
function manilaTomorrow(): string {
	return new Date(Date.now() + 8 * 3_600_000 + 86_400_000).toISOString().slice(0, 10);
}

test.describe('visit flow, follow-ups and referrals', () => {
	test('starting and ending the visit on the encounter page moves the queue ticket', async ({ page, browser }) => {
		test.setTimeout(120_000);
		const errors = trackErrors(page);
		const marker = `E2E chart flow ${Date.now().toString(36)}`;

		// Front desk: a walk-in for the admin doctor's line.
		await logIn(page, '/queue', FRONT_DESK);
		await page.getByRole('button', { name: 'Walk-in' }).click();
		const dialog = page.getByRole('dialog');
		await dialog.getByLabel('Find the patient').fill('Pedro Villanueva');
		await dialog
			.getByRole('list', { name: 'Matching patients' })
			.getByRole('button', { name: /Pedro Villanueva/ })
			.first()
			.click();
		await dialog.getByRole('combobox', { name: "Doctor's line" }).click();
		await page.getByRole('option', { name: /Test Admin/ }).click();
		await dialog.getByLabel('Reason for the visit').fill(marker);
		await dialog.getByRole('button', { name: 'Check in', exact: true }).click();
		await expect(page.getByRole('status').filter({ hasText: 'checked in' })).toContainText(/number A-\d{3}/);
		const ticket = page.getByTestId('queue-ticket').filter({ hasText: marker });
		const code = (await ticket.getAttribute('data-code'))!;

		// The doctor opens the visit (still at triage) from the patient's chart and starts the consult there.
		const doctor = await signedIn(browser, '/patients', USER);
		await doctor.getByLabel('Search patients').fill('Pedro Villanueva');
		await doctor
			.getByTestId('patient-list')
			.getByRole('link', { name: /Pedro Villanueva/ })
			.click();
		await doctor
			.getByTestId('encounter-list')
			.getByRole('link', { name: new RegExp(marker) })
			.click();
		await expect(doctor.getByTestId('encounter-title')).toContainText(marker);
		const visitUrl = doctor.url();
		// A visit opened at check-in (OPEN, booked doctor) has the AI scribe.
		await expect(doctor.getByRole('tab', { name: 'AI scribe' })).toBeVisible();
		await doctor.getByRole('button', { name: 'Start consult' }).click();
		await expect(doctor.getByRole('button', { name: 'Send to billing' })).toBeVisible();

		// The ticket followed: the patient is with the doctor, not at triage.
		await doctor.goto('/my-queue');
		await expect(doctor.getByRole('region', { name: `With you: ${code}` })).toBeVisible();

		// Sent to billing from the chart: the ticket waits at the cashier.
		await doctor.goto(visitUrl);
		await doctor.getByRole('button', { name: 'Send to billing' }).click();
		await expect(doctor.getByRole('button', { name: 'Complete visit' })).toBeVisible();
		await page.reload();
		await expect(page.getByRole('list', { name: 'Cashier line' }).locator(`[data-code="${code}"]`)).toBeVisible();

		// Completed from the chart: the ticket leaves the lines.
		await doctor.getByRole('button', { name: 'Complete visit' }).click();
		await expect(doctor.getByTestId('encounter-status-actions')).toBeHidden();
		await page.reload();
		await expect(page.getByRole('list', { name: 'Cashier line' }).locator(`[data-code="${code}"]`)).toBeHidden();
		await expect(page.locator(`[data-code="${code}"]`)).toHaveAttribute('data-status', 'DONE');
		expect(errors).toEqual([]);
	});

	test('the front desk books a due follow-up from the list, with the patient and doctor filled in', async ({
		page,
	}) => {
		test.setTimeout(120_000);
		const errors = trackErrors(page);
		const marker = `E2E follow-up ${Date.now().toString(36)}`;
		await logIn(page, '/follow-ups', FRONT_DESK);
		await expect(page.getByRole('heading', { name: 'Follow-ups' })).toBeVisible();
		const row = page.getByTestId('follow-up-row').filter({ hasText: 'Teresita Cabahug' });
		await expect(row).toContainText(/Overdue \d+ d/);
		await expect(row).toContainText('For follow-up');

		await row.getByRole('button', { name: 'Book follow-up for Teresita Cabahug' }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog.getByText('Teresita Cabahug')).toBeVisible();
		await expect(dialog.getByRole('combobox', { name: 'Doctor' })).toContainText(/Reyes/);
		await expect(dialog.getByRole('combobox', { name: 'Visit' })).toContainText('Follow-up');
		const day = manilaTomorrow();
		await dialog.getByLabel('Day').fill(day);
		await dialog.getByRole('group', { name: 'Open slots' }).getByRole('button').first().click();
		await dialog.getByLabel('Reason for the visit').fill(marker);
		await dialog.getByRole('button', { name: 'Book', exact: true }).click();
		await expect(dialog).toBeHidden();
		// Booked with her doctor: off the list.
		await expect(row).toBeHidden();

		// Clean up: cancel the booking (a cancelled booking doesn't count), and she is due again.
		await page.goto(`/appointments?date=${day}`);
		const booking = page.getByTestId('appointment-row').filter({ hasText: marker });
		await booking.getByRole('button', { name: /^Cancel/ }).click();
		await page.getByRole('dialog').getByLabel('Reason').fill('E2E clean-up');
		await page
			.getByRole('dialog')
			.getByRole('button', { name: /Cancel booking|Cancel appointment/ })
			.click();
		await expect(booking).toContainText('Cancelled');
		await page.goto('/follow-ups');
		await expect(page.getByTestId('follow-up-row').filter({ hasText: 'Teresita Cabahug' })).toBeVisible();
		expect(errors).toEqual([]);
	});

	test('the receiving doctor accepts, completes and declines referrals; the letter prints', async ({
		page,
		browser,
	}) => {
		test.setTimeout(120_000);
		const marker = Date.now().toString(36);
		// Dr. Reyes refers Roberto Lim (seeded visit) to Dr. Cruz twice.
		await logIn(page, '/referrals?box=outbox', DOCTOR);
		type Sent = {
			id: string;
			reason: string;
			encounterId: string;
			patientId: string;
			patientName: string;
			toPractitioner: { id: string } | null;
		};
		const sent = () =>
			gql<{ referrals: Sent[] }>(
				page,
				'query { referrals(input: { box: OUTBOX }) { id reason encounterId patientId patientName toPractitioner { id } } }',
				{},
			).then((data) => data.referrals);
		const seeded = (await sent()).find((row) => row.patientName === 'Roberto Lim' && row.toPractitioner)!;

		// One from the visit's Referrals tab, as the doctor writes it.
		await page.goto(`/patients/${seeded.patientId}/encounters/${seeded.encounterId}?tab=referrals`);
		await page.getByRole('button', { name: 'Refer', exact: true }).click();
		const editor = page.getByTestId('referral-editor');
		await editor.getByRole('combobox', { name: 'Doctor' }).click();
		await page.getByRole('option', { name: /Cruz/ }).click();
		await editor.getByLabel('Specialty').fill('Internal Medicine');
		await editor.getByLabel('Reason for referral').fill(`E2E evaluate ${marker}`);
		await editor.getByRole('button', { name: 'Send referral' }).click();
		await expect(page.getByTestId('referral-card').filter({ hasText: `E2E evaluate ${marker}` })).toContainText(
			'Waiting for an answer',
		);
		const toComplete = (await sent()).find((row) => row.reason === `E2E evaluate ${marker}`)!.id;

		const refer = (reason: string) =>
			gql<{ createReferral: { id: string } }>(
				page,
				'mutation ($input: CreateReferralInput!) { createReferral(input: $input) { id } }',
				{
					input: {
						encounterId: seeded.encounterId,
						toPractitionerId: seeded.toPractitioner!.id,
						reason,
						clinicalSummary: 'FBS 182 mg/dL, polyuria. Synthetic e2e.',
					},
				},
			).then((data) => data.createReferral.id);
		await refer(`E2E decline ${marker}`);

		// Dr. Cruz: accept with a note, then complete with the response notes.
		const cruz = await signedIn(browser, '/referrals', INTERNIST);
		const accepting = cruz.getByTestId('referral-row').filter({ hasText: `E2E evaluate ${marker}` });
		await expect(accepting).toContainText('Waiting for an answer');
		await accepting.getByRole('button', { name: 'Accept referral of Roberto Lim' }).click();
		await cruz.getByRole('dialog').getByLabel('Note (optional)').fill('Seen on Thursday.');
		await cruz.getByRole('dialog').getByRole('button', { name: 'Accept' }).click();
		await expect(accepting).toContainText('Accepted');
		await accepting.getByRole('button', { name: 'Complete referral of Roberto Lim' }).click();
		const complete = cruz.getByRole('dialog').getByRole('button', { name: 'Complete' });
		await expect(complete).toBeDisabled();
		await cruz.getByRole('dialog').getByLabel('Response notes').fill('Metformin started; back to Dr. Reyes.');
		await complete.click();
		await expect(accepting).toContainText('Completed');
		await expect(accepting).toContainText('Metformin started');

		// Decline the other, with the reason.
		const declining = cruz.getByTestId('referral-row').filter({ hasText: `E2E decline ${marker}` });
		await declining.getByRole('button', { name: 'Decline referral of Roberto Lim' }).click();
		await cruz.getByRole('dialog').getByLabel('Reason').fill('Better seen by endocrinology.');
		await cruz.getByRole('dialog').getByRole('button', { name: 'Decline' }).click();
		await expect(declining).toContainText('Declined');

		// Dr. Reyes sees the answers in the sent box and prints the letter.
		await page.goto('/referrals?box=outbox');
		await expect(page.getByTestId('referral-row').filter({ hasText: `E2E evaluate ${marker}` })).toContainText(
			'Completed',
		);
		await page.goto(`/print/referral/${toComplete}`);
		const letter = page.getByRole('article', { name: /Referral letter/ });
		await expect(letter).toContainText('REFERRAL');
		await expect(letter).toContainText('Tagbilaran City Health Center');
		await expect(letter).toContainText(`E2E evaluate ${marker}`);
		await expect(letter).toContainText('E11.9');
		await expect(letter).toContainText('PRC Lic. No. 0000001');
		await expect(letter).toContainText('PTR No. 9000001');
		await expect(page.getByRole('button', { name: 'Print or save as PDF' })).toBeEnabled();
	});
});
