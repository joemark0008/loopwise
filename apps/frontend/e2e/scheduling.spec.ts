import { expect, test } from '@playwright/test';
import { logIn, trackErrors, USER } from './helpers';
import type { Browser, Page } from '@playwright/test';

/** The seeded front desk and nurse at TAG; the admin is also a doctor, with extended clinic hours (06:00–23:30). */
const FRONT_DESK = { email: 'front.desk@loopwise.test', password: 'test1234' };
const NURSE = { email: 'nurse.santos@loopwise.test', password: 'test1234' };
const DOCTOR_OPTION = /Test Admin/;

async function signedIn(browser: Browser, path: string, user: { email: string; password: string }): Promise<Page> {
	const page = await (await browser.newContext()).newPage();
	await logIn(page, path, user);
	return page;
}

/** Picks a registered patient in a booking or check-in dialog. */
async function pickPatient(page: Page, name: string) {
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Find the patient').fill(name);
	await dialog
		.getByRole('list', { name: 'Matching patients' })
		.getByRole('button', { name: new RegExp(name) })
		.first()
		.click();
}

async function pickDoctor(page: Page, label: string) {
	await page.getByRole('dialog').getByRole('combobox', { name: label }).click();
	await page.getByRole('option', { name: DOCTOR_OPTION }).click();
}

test.describe('front desk, triage and the doctor', () => {
	test('a booking is checked in, triaged and reaches the doctor, who starts the visit', async ({ page, browser }) => {
		test.setTimeout(120_000);
		const errors = trackErrors(page);
		const marker = `E2E booking ${Date.now().toString(36)}`;

		// Front desk: book Ana Lopez today with the admin doctor, then check her in.
		await logIn(page, '/appointments', FRONT_DESK);
		await expect(page.getByRole('heading', { name: 'Appointments' })).toBeVisible();
		await page.getByRole('button', { name: 'Book', exact: true }).click();
		await pickPatient(page, 'Ana Lopez');
		await pickDoctor(page, 'Doctor');
		const slots = page.getByRole('group', { name: 'Open slots' });
		// The admin doctor holds clinic 06:00–23:30: only a run after the last slot has none left today.
		await expect(slots.or(page.getByText(/No open slot/))).toBeVisible();
		test.skip(!(await slots.isVisible()), 'No slot left today');
		await slots.getByRole('button').first().click();
		await page.getByRole('dialog').getByLabel('Reason for the visit').fill(marker);
		await page.getByRole('dialog').getByRole('button', { name: 'Book', exact: true }).click();
		await expect(page.getByRole('dialog')).toBeHidden();

		const row = page.getByTestId('appointment-row').filter({ hasText: marker });
		await expect(row).toContainText('Booked');
		await row.getByRole('button', { name: /^Check in/ }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Check in', exact: true }).click();
		await expect(row).toContainText('Checked in');

		// Nurse: call the patient, take the vitals and the chief complaint, send them to the doctor.
		const nurse = await signedIn(browser, '/triage', NURSE);
		const waiting = nurse
			.getByRole('list', { name: 'Waiting for triage' })
			.getByTestId('queue-ticket')
			.filter({ hasText: marker });
		await expect(waiting).toBeVisible();
		const code = (await waiting.getAttribute('data-code'))!;
		expect(code).toMatch(/^A-\d{3}$/);
		await waiting.getByRole('button', { name: 'Call' }).click();
		await nurse
			.getByRole('region', { name: `Called ${code}` })
			.getByRole('button', { name: 'Start triage' })
			.click();
		const triage = nurse.getByRole('region', { name: `Triage of ${code}` });
		await triage.getByLabel('Systolic BP').fill('150');
		await triage.getByLabel('Diastolic BP').fill('95');
		await triage.getByLabel('Chief complaint').fill(`${marker}, headache`);
		await triage.getByRole('button', { name: /^Send to/ }).click();
		await expect(triage).toBeHidden();

		// Doctor: the patient is in their own line; call, start the visit, open it, send them to the cashier.
		const doctor = await signedIn(browser, '/my-queue', USER);
		const line = doctor.getByRole('list', { name: 'Waiting for you' }).locator(`[data-code="${code}"]`);
		await expect(line).toContainText('Ana Lopez');
		await line.getByRole('button', { name: 'Call' }).click();
		const current = doctor.getByRole('region', { name: `With you: ${code}` });
		await current.getByRole('button', { name: 'Start visit' }).click();
		await expect(current.getByRole('link', { name: 'Open the visit' })).toBeVisible();
		await current.getByRole('button', { name: 'Send to cashier' }).click();
		await expect(current).toBeHidden();

		// The front desk sees them in the cashier's line.
		await page.goto('/queue');
		await expect(page.getByRole('list', { name: 'Cashier line' }).locator(`[data-code="${code}"]`)).toBeVisible();
		expect(errors).toEqual([]);
	});

	test('a senior walk-in gets a P number and is called before the regular lane', async ({ page, browser }) => {
		test.setTimeout(120_000);
		const marker = `E2E priority ${Date.now().toString(36)}`;
		await logIn(page, '/queue', FRONT_DESK);
		await page.getByRole('button', { name: 'Walk-in' }).click();
		await pickPatient(page, 'Jose Ramos');
		await pickDoctor(page, "Doctor's line");
		await page.getByRole('dialog').getByRole('combobox', { name: 'Priority lane' }).click();
		await page.getByRole('option', { name: /Senior citizen/ }).click();
		await page.getByRole('dialog').getByLabel('Reason for the visit').fill(marker);
		await page.getByRole('dialog').getByRole('button', { name: 'Check in', exact: true }).click();
		await expect(page.getByRole('status')).toContainText(/number P-\d{3}/);

		// The priority lane heads the triage line, ahead of the patients who came earlier.
		const triageLine = page.getByRole('list', { name: 'Triage line' }).getByTestId('queue-ticket');
		await expect(triageLine.first()).toHaveAttribute('data-code', /^P-/);
		const ours = triageLine.filter({ hasText: marker });
		const code = (await ours.getAttribute('data-code'))!;

		// The board shows numbers, never names.
		const board = await signedIn(browser, '/board', FRONT_DESK);
		await expect(board.getByTestId('board-waiting').filter({ hasText: code })).toBeVisible();
		await expect(board.getByTestId('queue-board')).not.toContainText('Ramos');

		// The nurse's Call next takes the priority lane first.
		const nurse = await signedIn(browser, '/triage', NURSE);
		await nurse.getByRole('button', { name: 'Call next' }).click();
		await expect(nurse.getByRole('region', { name: /^Called P-/ }).first()).toBeVisible();

		// Clean up: the patient left; the visit and the booking are cancelled with the reason.
		await page.reload();
		await page
			.getByTestId('queue-ticket')
			.filter({ hasText: marker })
			.getByRole('button', { name: /^Cancel/ })
			.click();
		await page.getByRole('dialog').getByLabel('Reason').fill('Left before triage (e2e)');
		await page.getByRole('dialog').getByRole('button', { name: 'Cancel visit' }).click();
		await expect(page.getByRole('list', { name: 'Triage line' }).locator(`[data-code="${code}"]`)).toBeHidden();
	});
});
