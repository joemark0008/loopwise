import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { logIn, trackErrors, USER } from './helpers';
import { logInAs } from './lab-flow';
import type { Page } from '@playwright/test';

const CLERK = { email: 'stock.villanueva@loopwise.test', password: 'test1234' };
const PHARMACIST = { email: 'pharm.garcia@loopwise.test', password: 'test1234' };

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + 8 * 3600 * 1000 + days * DAY).toISOString().slice(0, 10);

/** Picks an option of one of the app's selects by its accessible name. */
async function choose(page: Page, label: string | RegExp, option: string | RegExp, scope = page.locator('body')) {
	await scope.getByRole('combobox', { name: label }).click();
	await page.getByRole('option', { name: option }).first().click();
}

/** Serious and critical WCAG 2.1 AA violations of the pharmacy screen (as the other screens' checks). */
async function blockingViolations(page: Page): Promise<string[]> {
	const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
	return results.violations
		.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
		.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
}

/**
 * Pharmacy and inventory on the seeded demo (`npm run db:seed` or `db:seed:inventory`): an item received in two lots,
 * an issued prescription dispensed in part first expiry first out, the stock ledger with its balances, and the alerts.
 * Runs again on the same database: the item and its generic carry a run token.
 */
test.describe('pharmacy', () => {
	const run = Date.now().toString(36).toUpperCase();
	const generic = `Cetirizine E2E${run}`;
	const itemName = `${generic} 10 mg tablet`;

	test('receives two lots, dispenses part of a prescription first expiry first out and keeps the ledger', async ({
		page,
	}) => {
		test.setTimeout(120_000);
		const errors = trackErrors(page);

		// The stock room adds the item (reorder level above what will be left, for the alert) and receives it.
		await logInAs(page, CLERK, '/pharmacy/items');
		await expect(page.getByRole('tab', { name: 'Dispense' })).toHaveCount(0);
		await page.getByRole('button', { name: 'Add item' }).click();
		const dialog = page.getByRole('dialog');
		await dialog.getByLabel('SKU').fill(`E2E-${run}`);
		await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill(itemName);
		await dialog.getByLabel('Generic name').fill(generic);
		await dialog.getByLabel('Strength').fill('10 mg');
		await dialog.getByLabel('Dosage form').fill('tablet');
		await dialog.getByRole('textbox', { name: 'Unit', exact: true }).fill('tab');
		await dialog.getByLabel('Reorder level').fill('150');
		await dialog.getByRole('button', { name: 'Add item' }).click();
		await expect(dialog).toBeHidden();

		await page.getByRole('tab', { name: 'Receive stock' }).click();
		await choose(page, 'Supplier', /Bohol Synthetic Pharma/);
		await page.getByLabel('DR no.').fill(`DR-E2E-${run}`);
		await page.getByRole('button', { name: 'Add a line' }).click();
		const lots = [
			{ lotNo: `A${run}`, expiry: inDays(30), quantity: '5' },
			{ lotNo: `B${run}`, expiry: inDays(400), quantity: '100' },
		];
		for (const [index, lot] of lots.entries()) {
			const line = page.getByRole('group', { name: `Line ${index + 1}` });
			await choose(page, `Item of line ${index + 1}`, itemName, line);
			await line.getByLabel('Lot no.').fill(lot.lotNo);
			await line.getByLabel('Expiry').fill(lot.expiry);
			await line.getByLabel('Quantity').fill(lot.quantity);
			await line.getByLabel('Unit cost (₱)').fill('2');
		}
		await page.getByRole('button', { name: 'Receive stock' }).click();
		await expect(page.getByRole('status').filter({ hasText: /Received as TAG-RR-/ })).toBeVisible();

		// The doctor issues a prescription for 8 tablets on Maria's visit.
		await logInAs(page, USER, '/patients');
		await page.getByLabel('Search patients').fill('Maria Santos');
		await page
			.getByTestId('patient-list')
			.getByRole('link', { name: /Maria Santos/ })
			.click();
		await page
			.getByTestId('encounter-list')
			.getByRole('link', { name: /Fatigue, frequent urination/ })
			.click();
		await page.getByRole('tab', { name: /Prescriptions/ }).click();
		if ((await page.getByTestId('prescription-editor').count()) === 0) {
			await page.getByRole('button', { name: 'New prescription' }).click();
		}
		const editor = page.getByTestId('prescription-editor');
		await editor.getByLabel('Generic name').fill(generic);
		await editor.getByLabel('Strength').fill('10 mg');
		await editor.getByLabel('Dose').fill('1 tablet');
		await editor.getByLabel('Frequency').fill('once a day');
		await editor.getByRole('textbox', { name: 'Quantity', exact: true }).fill('8');
		await editor.getByRole('button', { name: 'Save draft' }).click();
		await editor.getByRole('button', { name: 'Issue prescription' }).click();
		await expect(page.getByTestId('prescription-editor')).toHaveCount(0);

		// The pharmacist dispenses 6 of the 8: 5 from the lot expiring first, 1 from the next.
		await logInAs(page, PHARMACIST, '/pharmacy/dispense');
		const row = page.getByTestId('dispense-row').filter({ hasText: generic });
		await expect(row).toContainText('Maria Santos');
		await row.getByRole('link', { name: /Dispense TAG-RX-/ }).click();
		const line = page.getByRole('region', { name: `${generic} 10 mg` });
		await expect(line).toContainText(`First expiry: lot A${run}`);
		await line.getByLabel('Quantity').fill('6');
		await page.getByRole('button', { name: 'Dispense 1 medicine' }).click();
		await expect(page.getByRole('status').filter({ hasText: 'still has medicines to give' })).toBeVisible();
		await expect(page.getByRole('region', { name: `${generic} 10 mg` })).toContainText('given 6 · left 2');
		expect(await blockingViolations(page)).toEqual([]);

		// The stock card: two receipts, then the dispense split over the two lots, with the balance after each.
		await page.getByRole('tab', { name: 'Items' }).click();
		await page.getByLabel('Search items').fill(generic);
		await page.getByRole('link', { name: itemName }).click();
		const ledger = page.getByTestId('ledger-row');
		await expect(ledger).toHaveCount(4);
		await expect(ledger.nth(0)).toContainText(`B${run}`);
		await expect(ledger.nth(0)).toContainText('−1');
		await expect(ledger.nth(0)).toContainText('99');
		await expect(ledger.nth(1)).toContainText(`A${run}`);
		await expect(ledger.nth(1)).toContainText('−5');
		await expect(ledger.nth(1)).toContainText('100');
		await expect(ledger.nth(2)).toContainText('Received');
		await expect(ledger.nth(2)).toContainText('105');

		// The overview: the item is now low (99 at or below 150); the seeded expired lot waits for disposal.
		await page.getByRole('tab', { name: 'Overview' }).click();
		await expect(page.getByTestId('low-stock')).toContainText(itemName);
		await expect(page.getByTestId('expired-lots')).toContainText('PCM-2504');
		expect(errors).toEqual([]);
	});

	test('the pharmacy desk opens on the pharmacy and lists the stock alerts', async ({ page }) => {
		const errors = trackErrors(page);
		await logIn(page, '/', PHARMACIST);
		await expect(page).toHaveURL(/\/pharmacy$/);
		await expect(page.getByRole('heading', { name: 'Pharmacy', level: 1 })).toBeVisible();
		await expect(page.getByTestId('stat-expired')).toBeVisible();
		await expect(page.getByTestId('expiring-lots')).toContainText('AMX-2505');
		expect(await blockingViolations(page)).toEqual([]);
		expect(errors).toEqual([]);
	});
});
