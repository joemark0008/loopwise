import { expect, test } from '@playwright/test';
import { asUser } from './db';
import { logIn, trackErrors, USER } from './helpers';

/**
 * Wise analytics (DESIGN.md §7.2): "how many patients do I have" is answered from a certified metric run as the user,
 * and the card shows the query on request. The expected count is read from the database as the same user (row-level
 * security, as the metric runs), so the test holds on a database that earlier runs added patients to. Real LLM call.
 */
test('Wise counts my patients from a certified metric and shows the query (real LLM call)', async ({ page }) => {
	test.setTimeout(180_000);
	const errors = trackErrors(page);
	// The certified `panel_size` metric: `analytics.patients` is the user's patients that aren't deleted.
	const expected = await asUser(USER.email, async (client) => {
		const { rows } = await client.query<{ count: number }>(
			'SELECT count(*)::int AS count FROM patients WHERE deleted_at IS NULL',
		);
		return rows[0].count;
	});
	await logIn(page, '/');
	await page.locator('[contenteditable]').first().click();
	await page.keyboard.type('How many patients do I have?');
	await page.keyboard.press('Enter');

	const card = page.getByTestId('analytics-result').first();
	await expect(card).toBeVisible({ timeout: 120_000 });
	await expect(card).toContainText(new RegExp(`\\b${expected}\\b`));
	await card.getByRole('button', { name: 'View query' }).click();
	await expect(card).toContainText(/FROM patients/i);
	expect(errors).toEqual([]);
});

test('Wise answers "how many patients do I have, by age group, as a chart" with a chart (real LLM call)', async ({
	page,
}) => {
	test.setTimeout(180_000);
	const errors = trackErrors(page);
	await logIn(page, '/');
	await page.locator('[contenteditable]').first().click();
	await page.keyboard.type('How many patients do I have, by age group, as a chart?');
	await page.keyboard.press('Enter');

	const chart = page.getByTestId('analytics-chart').first();
	await expect(chart).toBeVisible({ timeout: 120_000 });
	await expect(chart.locator('svg .recharts-bar-rectangle').first()).toBeVisible();
	const cards = page.getByTestId('analytics-result');
	await cards
		.filter({ has: page.getByRole('button', { name: 'Table' }) })
		.first()
		.getByRole('button', { name: 'Table' })
		.click();
	const table = cards.filter({ has: page.getByRole('button', { name: 'Chart' }) }).first();
	await expect(table).toContainText('40-59');
	await expect(table).toContainText('60+');
	expect(errors).toEqual([]);
});

test('Wise opens a report in the side panel and changes it in place (real LLM call)', async ({ page }) => {
	test.setTimeout(240_000);
	const errors = trackErrors(page);
	await logIn(page, '/');
	await page.locator('[contenteditable]').first().click();
	await page.keyboard.type('Make a short report of my panel with a chart of my patients by age group');
	await page.keyboard.press('Enter');

	const panel = page.getByTestId('report-panel');
	await expect(panel).toBeVisible({ timeout: 150_000 });
	await expect(panel.locator('svg .recharts-bar-rectangle').first()).toBeVisible();
	await expect(panel.getByLabel('Version')).toHaveValue('1');
	await expect(page.getByTestId('report-chip')).toContainText('v1');

	await page.locator('[contenteditable]').first().click();
	await page.keyboard.type('Add a table of my patients by barangay to the report');
	await page.keyboard.press('Enter');
	await expect(panel.getByLabel('Version')).toHaveValue('2', { timeout: 150_000 });
	await expect(panel).toContainText('Cogon');
	expect(errors).toEqual([]);
});

test("Wise draws my patients' HbA1c vs BMI as a scatter, and the screening funnel (real LLM call)", async ({
	page,
}) => {
	test.setTimeout(240_000);
	const errors = trackErrors(page);
	await logIn(page, '/');
	await page.locator('[contenteditable]').first().click();
	await page.keyboard.type("Show my patients' latest HbA1c vs latest BMI as a scatter");
	await page.keyboard.press('Enter');
	await expect(page.locator('[data-chart-type="scatter"] svg').first()).toBeVisible({ timeout: 150_000 });
	await expect(page.locator('[data-chart-type="scatter"] .recharts-scatter-symbol').first()).toBeVisible();

	await page.locator('[contenteditable]').first().click();
	await page.keyboard.type('Show the screening funnel');
	await page.keyboard.press('Enter');
	const funnel = page.locator('[data-chart-type="funnel"]').first();
	await expect(funnel).toBeVisible({ timeout: 150_000 });
	await expect(funnel).toContainText('Ordered');
	expect(errors).toEqual([]);
});
