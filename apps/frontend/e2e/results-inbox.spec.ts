import { expect, test } from '@playwright/test';
import { DOCTOR, trackErrors } from './helpers';
import { logInAs, releasedHbA1c } from './lab-flow';

test.describe('results inbox', () => {
	test('a result the lab releases appears in the inbox and is marked reviewed', async ({ page }) => {
		const errors = trackErrors(page);
		// A value no other result has, so the row is unambiguous: 7.10–7.99.
		const value = `7.${10 + (Date.now() % 90)}`;
		await releasedHbA1c(page, 'Maria Santos', value);

		await logInAs(page, DOCTOR, '/results');
		await expect(page.getByRole('heading', { name: 'Results to review' })).toBeVisible();
		const row = page.getByTestId('result-row').filter({ hasText: `${value} %` });
		await expect(row).toHaveCount(1);
		await expect(row).toContainText('Maria Santos');
		await expect(row).toContainText('High');
		const chartLink = row.getByRole('link', { name: 'Maria Santos' });
		await expect(chartLink).toHaveAttribute('href', /\/patients\/.+\/results$/);
		const chartPath = (await chartLink.getAttribute('href')) ?? '';

		await row.getByRole('button', { name: 'Mark reviewed' }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog.getByTestId('result-values')).toContainText(`${value} %`);
		await dialog.getByLabel('Note (optional)').fill('Diabetes range; discuss at follow-up');
		await dialog.getByRole('button', { name: 'Mark reviewed' }).click();
		await expect(dialog).toBeHidden();
		await expect(row).toHaveCount(0);

		// The chart's Results tab keeps it, now reviewed.
		await page.goto(chartPath);
		await expect(page.getByTestId('patient-name')).toContainText('Maria Santos');
		const charted = page.getByTestId('result-row').filter({ hasText: `${value} %` });
		await expect(charted).toContainText('Reviewed');
		expect(errors).toEqual([]);
	});
});
