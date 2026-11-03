import { expect, test } from '@playwright/test';
import { logIn, trackErrors } from './helpers';

/**
 * "AI drafts, the clinician confirms" for an edit (DESIGN.md §9.1): Wise proposes a change to an encounter's note as a
 * before → after card, nothing is saved until Confirm, and a reload shows the card settled, never confirmable again.
 */
test.describe('Wise edits an encounter note', () => {
	test.beforeEach(async ({ page }) => {
		await logIn(page, '/patients');
	});

	test('shows the before → after, saves on Confirm and stays settled after a reload (real LLM call)', async ({
		page,
	}) => {
		test.setTimeout(180_000);
		const errors = trackErrors(page);
		const marker = `recheck BP ${Date.now().toString(36)}`;
		await page.getByLabel('Search patients').fill('THC-0002');
		await page.getByTestId('patient-list').getByRole('link').first().click();
		await expect(page.getByTestId('patient-name')).toBeVisible();

		const panel = page.getByRole('region', { name: 'Ask Wise' });
		await panel.locator('[contenteditable]').first().click();
		await page.keyboard.type(`Change the plan of the latest encounter to exactly: "${marker}". Nothing else.`);
		await page.keyboard.press('Enter');

		const card = panel.getByTestId('propose-encounter-note').last();
		await expect(card.getByTestId('proposal-diff-plan').locator('ins')).toContainText(marker, { timeout: 120_000 });
		await expect(card).toContainText('Changes an existing record');
		await expect(card.getByTestId('proposal-target')).toContainText('Encounter note');

		await card.getByRole('button', { name: 'Save changes' }).click();
		await expect(card).toContainText('Note updated');

		await page.getByTestId('encounter-list').getByRole('link').first().click();
		await expect(page.getByRole('textbox', { name: 'Plan (P)' })).toHaveValue(marker);

		await page.goBack();
		await page.reload();
		const settled = page.getByRole('region', { name: 'Ask Wise' }).getByTestId('propose-encounter-note').last();
		await expect(settled).toContainText('Note updated');
		await expect(settled.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
		expect(errors).toEqual([]);
	});
});
