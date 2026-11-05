import { expect, test } from '@playwright/test';
import { logIn, trackErrors } from './helpers';

/**
 * The encounter record (DESIGN.md §5) on Maria Santos's seeded first visit: vitals with the BMI, an ICD-10 diagnosis,
 * a prescription saved, issued (locked) and printed with the practitioner's PRC license, and the visit's invoice with
 * the senior citizen discount (RA 9994), issued and paid. The seed admin is a practitioner; the test sets its license.
 */
test.describe('encounter record', () => {
	test('records vitals and a diagnosis, issues and prints a prescription, then bills the visit', async ({ page }) => {
		const errors = trackErrors(page);
		await logIn(page, '/settings/account');
		// The form shows once the seeded profile has loaded; typing earlier would mix with its PRC number.
		await expect(page.getByText(/^Printed as /)).toBeVisible();
		await expect(page.getByLabel('PRC license number')).not.toHaveValue('');
		await page.getByLabel('PRC license number').fill('0000099');
		await page.getByLabel('Post-nominals').fill('MD');
		await page.getByRole('button', { name: 'Save profile' }).click();
		await expect(page.getByText('Saved.')).toBeVisible();

		await page.goto('/patients');
		await page.getByLabel('Search patients').fill('Maria Santos');
		await page
			.getByTestId('patient-list')
			.getByRole('link', { name: /Maria Santos/ })
			.click();
		// A visit on the chart opens its record directly.
		await page
			.getByTestId('encounter-list')
			.getByRole('link', { name: /Fatigue, frequent urination/ })
			.click();
		// The patient banner names the patient; the record's own heading is the visit.
		await expect(page.getByTestId('patient-name')).toHaveText('Maria Santos');
		await expect(page.getByTestId('encounter-title')).toContainText('Fatigue');

		// Vitals: the BMI shows as you type and is stored with the set.
		await page.getByRole('tab', { name: /Vitals/ }).click();
		const rowsBefore = await page.getByTestId('vitals-table').locator('tbody tr').count();
		await page.getByLabel('Systolic BP').fill('128');
		await page.getByLabel('Diastolic BP').fill('82');
		await page.getByLabel('Weight').fill('70');
		await page.getByLabel('Height').fill('155');
		await expect(page.getByTestId('bmi-preview')).toHaveText('BMI: 29.1');
		await page.getByRole('button', { name: 'Save vitals' }).click();
		await expect(page.getByTestId('vitals-table').locator('tbody tr')).toHaveCount(rowsBefore + 1);
		await expect(page.getByTestId('latest-vitals')).toContainText('BP 128/82');

		// Diagnosis: search ICD-10 by words, pick, add.
		await page.getByRole('tab', { name: /Note & diagnosis/ }).click();
		await page.getByLabel('Add a diagnosis').fill('upper respiratory');
		await page.getByRole('button', { name: /J06\.9/ }).click();
		await page.getByRole('button', { name: 'Add diagnosis' }).click();
		await expect(page.getByTestId('diagnosis-list')).toContainText(
			'Acute upper respiratory infection, unspecified',
		);

		// Prescription: a draft, then issued as the signed-in practitioner; issued ones can't be edited.
		await page.getByRole('tab', { name: /Prescriptions/ }).click();
		// A draft left on the visit (e.g. from Wise) is edited instead of starting a new one.
		if ((await page.getByTestId('prescription-editor').count()) === 0) {
			await page.getByRole('button', { name: 'New prescription' }).click();
		}
		const editor = page.getByTestId('prescription-editor');
		await editor.getByLabel('Generic name').fill('Paracetamol');
		await editor.getByLabel('Strength').fill('500 mg');
		await editor.getByLabel('Dose').fill('1 tablet');
		await editor.getByLabel('Frequency').fill('every 4 hours as needed');
		await editor.getByRole('textbox', { name: 'Quantity', exact: true }).fill('10');
		await editor.getByRole('button', { name: 'Save draft' }).click();
		await editor.getByRole('button', { name: 'Issue prescription' }).click();
		await expect(page.getByTestId('prescription-editor')).toHaveCount(0);
		const issued = page.getByTestId('prescription-card').filter({ hasText: 'Paracetamol' }).first();
		await expect(issued).toContainText('Issued');
		const printHref = await issued.getByRole('link', { name: 'Print' }).getAttribute('href');

		// Billing: the draft starts from the visit's suggested lines; senior discount, issue, pay in cash.
		await page.goto(page.url().replace(/\?.*$/, '') + '?tab=billing');
		const invoiceEditor = page.getByTestId('invoice-editor');
		await expect(invoiceEditor.or(page.getByTestId('invoice-card')).first()).toBeVisible();
		if (await invoiceEditor.isVisible()) {
			await invoiceEditor.getByRole('combobox', { name: 'Discount' }).click();
			await page.getByRole('option', { name: /Senior citizen/ }).click();
			await invoiceEditor.getByLabel('OSCA ID number').fill('OSCA-E2E-0001');
			await invoiceEditor.getByRole('button', { name: 'Save draft' }).click();
			await expect(page.getByTestId('invoice-discount')).toBeVisible();
			await invoiceEditor.getByRole('button', { name: 'Issue invoice' }).click();
		}
		const invoice = page.getByTestId('invoice-card').first();
		const payment = page.getByTestId('payment-form');
		if (await payment.isVisible()) {
			await payment.getByLabel('Cash tendered').fill('5000');
			await payment.getByRole('button', { name: 'Record payment' }).click();
			await expect(invoice).toContainText('Paid');
		}

		await page.goto(printHref ?? '/');
		await expect(page.getByRole('article', { name: /Prescription TAG-RX-/ })).toContainText('PRC Lic. No. 0000099');
		await expect(page.getByRole('article')).toContainText('Paracetamol 500 mg');
		expect(errors).toEqual([]);
	});
});
