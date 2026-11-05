import { expect, test } from '@playwright/test';
import { logIn, trackErrors } from './helpers';
import type { Page } from '@playwright/test';

/** Opens a seeded patient's chart from the patient list. */
async function openChart(page: Page, name: string) {
	await page.getByLabel('Search patients').fill(name);
	await page.getByTestId('patient-list').getByRole('link').first().click();
	await expect(page.getByTestId('patient-name')).toBeVisible();
}

test.describe('patient chart', () => {
	test.beforeEach(async ({ page }) => {
		await logIn(page, '/patients');
	});

	test('records an encounter with the New encounter form', async ({ page }) => {
		const errors = trackErrors(page);
		const reason = `Follow-up visit ${Date.now().toString(36)}`;
		await openChart(page, 'Liza');

		await page.getByRole('button', { name: 'New encounter' }).click();
		const dialog = page.getByRole('dialog');
		await dialog.getByRole('button', { name: 'Save encounter' }).click();
		await expect(dialog.getByText('Add the reason for the visit.')).toBeVisible();

		await dialog.getByLabel('Chief complaint').fill(reason);
		await dialog.getByLabel('Notes').fill('BP 130/85. Plan: recheck in 3 months.');
		await dialog.getByRole('button', { name: 'Save encounter' }).click();
		await expect(dialog).toBeHidden();

		// The visit is listed with its notes, and opens its record.
		const row = page.getByTestId('encounter-list').getByRole('link', { name: new RegExp(reason) });
		await expect(row).toContainText('BP 130/85. Plan: recheck in 3 months.');
		await row.click();
		await expect(page.getByTestId('encounter-title')).toContainText(reason);
		expect(errors).toEqual([]);
	});

	test('Wise drafts an encounter from the chart chat and the clinician saves it (real LLM call)', async ({
		page,
	}) => {
		test.setTimeout(180_000);
		// The model may reword the reason around the code; the token itself is unique.
		const marker = Date.now().toString(36);
		await openChart(page, 'Ana Lopez');

		const panel = page.getByRole('region', { name: 'Ask Wise' });
		await panel.locator('[contenteditable]').first().click();
		await page.keyboard.type(
			`Record today's encounter. Reason: dizziness (code ${marker}). Notes: BP 160/100, no chest pain; plan FBS.`,
		);
		await page.keyboard.press('Enter');

		const card = panel.getByTestId('propose-encounter').last();
		await expect(card).toContainText(marker, { timeout: 120_000 });
		await card.getByRole('button', { name: 'Save encounter' }).click();
		await expect(card).toContainText('Recorded');

		await expect(page.getByTestId('encounter-list')).toContainText(marker);
		await page.reload();
		await expect(panel.getByText(new RegExp(`I recorded the encounter: .*${marker}`))).toBeVisible();
	});
});

test.describe('patient chart layout', () => {
	test('Wise resizes from the keyboard, expands over the chart and collapses to a rail', async ({ page }) => {
		// A fresh layout once; the reload below must keep what the test chose.
		await page.addInitScript(() => {
			if (!sessionStorage.getItem('layout-reset')) {
				sessionStorage.setItem('layout-reset', '1');
				localStorage.removeItem('loopwise.wise-layout');
			}
		});
		await logIn(page, '/patients');
		await openChart(page, 'Maria Santos');
		const wise = page.locator('#patient-wise');
		const splitter = page.getByRole('separator', { name: 'Resize Wise' });
		await expect(splitter).toHaveAttribute('aria-valuenow', '440');
		await splitter.focus();
		await page.keyboard.press('ArrowLeft');
		await expect(splitter).toHaveAttribute('aria-valuenow', '464');

		await page.getByRole('button', { name: 'Expand Wise' }).click();
		await expect(page.getByRole('navigation', { name: 'Patient record' })).toBeHidden();
		await expect(page.getByTestId('patient-name')).toBeVisible();
		await page.getByRole('button', { name: 'Show the chart beside Wise' }).click();
		await expect(page.getByRole('navigation', { name: 'Patient record' })).toBeVisible();

		await page.getByRole('button', { name: 'Collapse Wise' }).click();
		await expect(wise).toBeHidden();
		await page.reload();
		await expect(page.getByTestId('patient-name')).toBeVisible();
		await expect(wise).toBeHidden();
		await page.getByRole('button', { name: 'Wise', exact: true }).click();
		await expect(wise.getByRole('region', { name: 'Ask Wise' })).toBeVisible();
	});
});
