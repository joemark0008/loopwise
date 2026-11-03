import { expect, test } from '@playwright/test';
import { logIn, trackErrors } from './helpers';

/**
 * The encounter record (DESIGN.md §7) on Maria Santos's seeded first visit: vitals with the BMI, an ICD-10 diagnosis,
 * a prescription saved, issued (locked) and printed. The seed admin gets a PRC license first (Settings → Account).
 */
test.describe('encounter record', () => {
	test('records vitals and a diagnosis, then issues and prints a prescription', async ({ page }) => {
		const errors = trackErrors(page);
		await logIn(page, '/settings/account');
		await page.getByLabel('PRC license number').fill('0000099');
		await page.getByLabel('Credentials').fill('MD');
		await page.getByRole('button', { name: 'Save profile' }).click();
		await expect(page.getByText('Saved.')).toBeVisible();

		await page.goto('/patients');
		await page.getByLabel('Search patients').fill('THC-0001');
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

		// Prescription: a draft, then issued as the signed-in clinician; issued ones can't be edited.
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
		await editor.getByLabel('Quantity').fill('10');
		await editor.getByRole('button', { name: 'Save draft' }).click();
		await editor.getByRole('button', { name: 'Issue prescription' }).click();
		await expect(page.getByTestId('prescription-editor')).toHaveCount(0);
		const issued = page.getByTestId('prescription-card').filter({ hasText: 'Paracetamol' }).first();
		await expect(issued).toContainText('Issued');

		// Billing: pre-filled with the consultation, senior discount, finalize, pay.
		await page.goto(page.url().replace(/\?.*$/, '') + '?tab=billing');
		const bill = page.getByTestId('bill-editor').or(page.getByTestId('bill-card')).first();
		await expect(bill).toBeVisible();
		if (await page.getByTestId('bill-editor').isVisible()) {
			await page.getByRole('combobox', { name: 'Discount' }).click();
			await page.getByRole('option', { name: /Senior citizen/ }).click();
			await page.getByRole('button', { name: 'Save draft' }).click();
			await page.getByRole('button', { name: 'Finalize bill' }).click();
		}
		const finalized = page.getByTestId('bill-card').first();
		if (await finalized.getByRole('button', { name: 'Mark paid' }).isVisible()) {
			await finalized.getByLabel('Official receipt number').fill('OR-E2E');
			await finalized.getByRole('button', { name: 'Mark paid' }).click();
			await expect(finalized).toContainText('Paid');
		}
		await page.goBack();

		const href = await issued.getByRole('link', { name: 'Print' }).getAttribute('href');
		await page.goto(href ?? '/');
		await expect(page.getByRole('article', { name: /Prescription RX-/ })).toContainText('PRC Lic. No. 0000099');
		await expect(page.getByRole('article')).toContainText('Paracetamol 500 mg');
		expect(errors).toEqual([]);
	});
});
