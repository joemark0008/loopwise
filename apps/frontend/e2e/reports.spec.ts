import { expect, test } from '@playwright/test';
import { logIn, trackErrors } from './helpers';

/**
 * Wise reports on the patient chart (DESIGN.md §9.2), on the seeded Maria Santos, who has a year of BP readings: the
 * chart chat writes a BP report that opens over the chart, downloads as a PDF, and is saved to the chart, where it is
 * listed under Documents. Real LLM call.
 */
test.describe('charts and reports', () => {
	test("Wise reports Maria's BP trend; the PDF downloads and the report saves to her chart (real LLM call)", async ({
		page,
	}) => {
		test.setTimeout(240_000);
		const errors = trackErrors(page);
		await logIn(page, '/patients');
		await page.getByLabel('Search patients').fill('THC-0001');
		await page
			.getByTestId('patient-list')
			.getByRole('link', { name: /Maria Santos/ })
			.click();
		await expect(page.getByTestId('patient-name')).toHaveText('Maria Santos');

		const wise = page.getByRole('region', { name: 'Ask Wise' });
		await wise.locator('[contenteditable]').first().click();
		await page.keyboard.type("Make a short report of Maria's blood pressure trend with the chart");
		await page.keyboard.press('Enter');

		const panel = page.getByTestId('report-panel');
		await expect(panel).toBeVisible({ timeout: 180_000 });
		await expect(panel.locator('svg .recharts-curve').first()).toBeVisible();
		await expect(panel).toContainText('Synthetic data — prototype');

		const download = page.waitForEvent('download');
		await panel.getByTestId('report-panel-download').click();
		expect((await download).suggestedFilename()).toMatch(/-v\d+-\d{4}-\d{2}-\d{2}\.pdf$/);

		await panel.getByTestId('report-save').click();
		await panel.getByTestId('report-save-confirm').click();
		await expect(panel.getByTestId('report-saved')).toBeVisible();
		expect(errors).toEqual([]);
	});
});
