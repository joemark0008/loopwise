import { expect, test } from '@playwright/test';
import { logIn, trackErrors, USER } from './helpers';
import type { Page } from '@playwright/test';

/** The seeded cashier at TAG (`seed-billing-desk.ts`: an open shift, Pedro's visit sent to the cashier). */
const CASHIER = { email: 'cashier.dela.cruz@loopwise.test', password: 'test1234' };

/** Closes the user's open shift with a Z reading (nothing counted), if one is open. */
async function closeShiftIfOpen(page: Page) {
	const panel = page.getByTestId('shift-panel');
	await expect(panel).toBeVisible();
	const close = panel.getByRole('button', { name: 'Close shift (Z reading)' });
	if (await close.isVisible()) {
		await close.click();
		await page.getByRole('dialog').getByRole('button', { name: 'Close shift' }).click();
		await expect(page.getByTestId('z-reading')).toBeVisible();
		await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
	}
	await expect(panel.getByRole('button', { name: 'Open shift' })).toBeVisible();
}

async function openShift(page: Page, openingCash: string) {
	const panel = page.getByTestId('shift-panel');
	await panel.getByLabel('Opening cash').fill(openingCash);
	await panel.getByRole('button', { name: 'Open shift' }).click();
	await expect(panel.getByRole('button', { name: 'X reading' })).toBeVisible();
}

test.describe('cashier desk', () => {
	test('a shift opens, takes an X reading, and closes with the Z reading and its variance', async ({ page }) => {
		const errors = trackErrors(page);
		await logIn(page, '/cashier', CASHIER);
		await expect(page.getByRole('heading', { name: 'Cashier' })).toBeVisible();
		await closeShiftIfOpen(page);

		await openShift(page, '1000');
		const panel = page.getByTestId('shift-panel');
		await expect(panel.getByTestId('shift-figures')).toContainText('₱1,000.00');
		await panel.getByRole('button', { name: 'X reading' }).click();
		await expect(panel.getByTestId('x-reading')).toContainText('expected in the drawer');

		// The Z reading: one ₱500 bill and four ₱100 bills against ₱1,000 expected (no cash taken): short ₱100.
		await panel.getByRole('button', { name: 'Close shift (Z reading)' }).click();
		const dialog = page.getByRole('dialog');
		await dialog.getByLabel('₱500').fill('1');
		await dialog.getByLabel('₱100').fill('4');
		await expect(dialog.getByTestId('z-reading-preview')).toContainText('-₱100.00');
		await dialog.getByLabel('Why the count differs').fill('E2E: short count');
		await dialog.getByRole('button', { name: 'Close shift' }).click();
		const reading = dialog.getByTestId('z-reading');
		await expect(reading).toContainText('Counted cash');
		await expect(reading).toContainText('₱900.00');
		await expect(reading).toContainText('-₱100.00');
		await dialog.getByRole('button', { name: 'Done' }).click();
		await expect(panel.getByRole('button', { name: 'Open shift' })).toBeVisible();

		// The closed shift is in the history; leave a shift open for the desk.
		await page.getByRole('tab', { name: 'Shifts' }).click();
		await expect(page.getByTestId('shift-history').filter({ hasText: 'E2E: short count' }).first()).toBeVisible();
		await page.getByRole('tab', { name: 'Desk' }).click();
		await openShift(page, '2000');
		expect(errors).toEqual([]);
	});

	test('load charges → senior discount → issue → split payment → print', async ({ page }) => {
		test.setTimeout(120_000);
		const errors = trackErrors(page);
		// The admin works every desk (draft, collect, void): its own shift first.
		await logIn(page, '/cashier', USER);
		const panel = page.getByTestId('shift-panel');
		await expect(panel).toBeVisible();
		if (await panel.getByRole('button', { name: 'Open shift' }).isVisible()) {
			await openShift(page, '500');
		}

		// Pedro, sent to the cashier: the queue's cashier line links to his visit's billing.
		await page.goto('/queue');
		await expect(page.getByRole('heading', { name: 'Cashier', exact: true })).toBeVisible();
		await expect(
			page.getByTestId('queue-ticket').first().or(page.getByText('Nobody in line').first()),
		).toBeVisible();
		const line = page.getByRole('list', { name: 'Cashier line' });
		const pedro = line.getByTestId('queue-ticket').filter({ hasText: 'Pedro' });
		test.skip((await pedro.count()) === 0, 'No visit at the cashier (run npm run db:seed:billing)');
		await pedro.first().getByRole('link', { name: 'Bill' }).click();
		await expect(page.getByRole('heading', { name: 'Invoice' })).toBeVisible();

		// A run before left an issued invoice: void it (admin), so the visit is billed again.
		const editor = page.getByTestId('invoice-editor');
		await expect(editor.or(page.getByTestId('invoice-card')).first()).toBeVisible();
		if (!(await editor.isVisible())) {
			await page.getByTestId('invoice-card').first().getByRole('button', { name: 'Void', exact: true }).click();
			await page.getByRole('dialog').getByRole('textbox').fill('E2E: billed again');
			await page.getByRole('dialog').getByRole('button', { name: 'Void' }).click();
			await expect(editor).toBeVisible();
		}

		// Loading saves the draft; the editor shows it once the visit's billing is read again.
		const reread = page.waitForResponse(
			(response) =>
				response.url().includes('graphql') &&
				(response.request().postData() ?? '').includes('query EncounterBilling'),
		);
		await editor.getByRole('button', { name: 'Load charges' }).click();
		await reread;
		await expect(editor).toContainText('Draft invoice');
		await expect(editor.getByTestId('invoice-line').first().getByLabel('Item')).toHaveValue(
			/Follow-up consultation/,
		);
		await expect(editor.getByTestId('invoice-line').nth(1).getByLabel('Item')).toHaveValue(/Fasting/i);

		await editor.getByRole('combobox', { name: 'Discount' }).click();
		await page.getByRole('option', { name: /Senior citizen/ }).click();
		await expect(editor.getByRole('combobox', { name: 'ID presented' })).toContainText('OSCA-TAG-SYN-0233');
		await editor.getByRole('button', { name: 'Save draft' }).click();
		await expect(editor.getByRole('button', { name: 'Issue invoice' })).toBeEnabled();
		await expect(editor.getByTestId('invoice-totals')).toContainText('Senior citizen');
		await editor.getByRole('button', { name: 'Issue invoice' }).click();

		const invoice = page.getByTestId('invoice-card').first();
		await expect(invoice).toContainText('Sales invoice SI-');
		await expect(page.getByTestId('invoice-discount')).toContainText('OSCA-TAG-SYN-0233');

		// Split tender: ₱100 in cash (₱200 handed over), the rest by GCash.
		const payment = page.getByTestId('payment-form');
		await payment.getByLabel('Amount').first().fill('100');
		await payment.getByLabel('Cash tendered').fill('200');
		await payment.getByRole('button', { name: 'Split tender' }).click();
		const gcash = payment.getByTestId('payment-tender').nth(1);
		await gcash.getByLabel('Reference number').fill('GC-E2E-0001');
		await payment.getByRole('button', { name: 'Record payment' }).click();
		await expect(invoice).toContainText('Paid');
		await expect(page.getByTestId('invoice-payments')).toContainText('GC-E2E-0001');
		await expect(page.getByTestId('invoice-payments')).toContainText('change ₱100.00');

		// The printed BIR sales invoice.
		const href = await invoice.getByRole('link', { name: 'Print' }).getAttribute('href');
		await page.goto(href ?? '/');
		const sheet = page.getByRole('article', { name: /Sales invoice SI-/ });
		await expect(sheet).toContainText('SALES INVOICE');
		await expect(sheet).toContainText('TIN');
		await expect(sheet.getByTestId('printed-totals')).toContainText('VAT-exempt sales');
		await expect(sheet.getByTestId('printed-sc-pwd')).toContainText('OSCA-TAG-SYN-0233');
		await expect(sheet).toContainText('ATP-DEMO-0001');
		expect(errors).toEqual([]);
	});
});
