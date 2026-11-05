import { expect, test } from '@playwright/test';
import { trackErrors } from './helpers';
import type { Page } from '@playwright/test';

const DOCTOR = { email: 'dr.reyes@loopwise.test', password: 'test1234' };
const LAB = { email: 'lab.bautista@loopwise.test', password: 'test1234' };

async function logInAs(page: Page, user: { email: string; password: string }, redirect = '/') {
	await page.context().clearCookies();
	await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`);
	await page.locator('input[name="email"]').fill(user.email);
	await page.locator('input[name="password"]').fill(user.password);
	await page.getByRole('button', { name: 'Log in', exact: true }).click();
	await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

/**
 * The lab side of an order (DESIGN.md §2 steps 1–4): Dr. Reyes orders an HbA1c from Maria Santos's visit, Bohol
 * Diagnostics accepts it and marks the specimen collected on its worklist, and the doctor sees the status.
 */
test.describe('lab orders', () => {
	test('doctor orders HbA1c, the lab accepts and collects it, the doctor sees it collected', async ({ page }) => {
		const errors = trackErrors(page);
		const note = `E2E ${Date.now()}`;

		// The doctor orders from the visit (the note tells this run's order apart on the worklist).
		await logInAs(page, DOCTOR, '/patients');
		await page.getByLabel('Search patients').fill('Maria');
		await page
			.getByTestId('patient-list')
			.getByRole('link', { name: /Maria Santos/ })
			.first()
			.click();
		await page.getByTestId('encounter-list').getByRole('link').first().click();
		const encounterUrl = page.url();
		await page.getByRole('tab', { name: /Orders/ }).click();
		await page.getByLabel('Test', { exact: true }).click();
		await page.getByRole('option', { name: 'Hemoglobin A1c' }).click();
		await page.getByLabel('Send to').click();
		await page.getByRole('option', { name: /Bohol Diagnostics/ }).click();
		await page.getByLabel('Notes').fill(note);
		await page.getByRole('button', { name: 'Order and send' }).click();
		const orderRow = page.getByTestId('order-list').locator('tr', { hasText: note });
		await expect(orderRow).toContainText('Sent');

		// The lab's home is its worklist; the order arrives under Incoming.
		await logInAs(page, LAB);
		await expect(page).toHaveURL(/\/orders/);
		await expect(page.getByRole('heading', { name: 'Orders received' })).toBeVisible();
		const incoming = page.getByTestId('lab-order-row').filter({ hasText: note });
		await expect(incoming).toContainText('Maria Santos');
		await expect(incoming).toContainText('Hemoglobin A1c');
		await expect(incoming).toContainText(/Reyes/);
		await incoming.getByRole('button', { name: /^Accept / }).click();
		await expect(incoming).toHaveCount(0);

		await page.getByRole('tab', { name: /Accepted/ }).click();
		const accepted = page.getByTestId('lab-order-row').filter({ hasText: note });
		await accepted.getByRole('button', { name: /collected$/ }).click();
		await expect(accepted).toHaveCount(0);
		await page.getByRole('tab', { name: /Collected/ }).click();
		await expect(page.getByTestId('lab-order-row').filter({ hasText: note })).toContainText('Collected');

		// Back at the clinic, the record shows the order collected.
		await logInAs(page, DOCTOR, new URL(encounterUrl).pathname);
		await page.getByRole('tab', { name: /Orders/ }).click();
		await expect(page.getByTestId('order-list').locator('tr', { hasText: note })).toContainText('Collected');
		expect(errors).toEqual([]);
	});
});
