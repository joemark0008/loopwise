import { expect, test } from '@playwright/test';
import { logIn, trackErrors } from './helpers';

test.describe('Wise navigation', () => {
	test.beforeEach(async ({ page }) => {
		await logIn(page, '/');
	});

	test("opens Maria Santos's record from a general chat, and comes back (real LLM call)", async ({ page }) => {
		test.setTimeout(180_000);
		const errors = trackErrors(page);
		await page.locator('[contenteditable]').first().click();
		await page.keyboard.type("Open Maria Santos's record.");
		await page.keyboard.press('Enter');

		await expect(page.getByTestId('patient-name')).toHaveText('Maria Santos', { timeout: 120_000 });
		expect(page.url()).toMatch(/\/patients\/[0-9a-f-]{36}$/);

		await page.getByRole('link', { name: 'Back to chat' }).click();
		await expect(page.getByTestId('open-page')).toContainText("Maria Santos's chart");
		const chatUrl = page.url();

		// Reopening the chat shows the card but never navigates again.
		await page.reload();
		await expect(page.getByTestId('open-page')).toBeVisible();
		await page.waitForTimeout(1_500);
		expect(page.url()).toBe(chatUrl);
		expect(errors).toEqual([]);
	});
});

test.describe('app shell', () => {
	test('the sidebar holds the admin doctor’s screens (and the lab desk), and Wise docks beside a list page', async ({
		page,
	}) => {
		await logIn(page, '/patients');
		const main = page.getByRole('navigation', { name: 'Main' });
		for (const label of ['Today', 'Patients', 'Results', 'Wise chats', 'Reports', 'Lab worklist']) {
			await expect(main.getByRole('link', { name: new RegExp(`^${label}`) })).toBeVisible();
		}
		await expect(main.getByRole('link', { name: /^Patients/ })).toHaveAttribute('aria-current', 'page');

		await page.getByRole('button', { name: 'Ask Wise' }).click();
		const dock = page.getByRole('complementary', { name: 'Wise' });
		await expect(dock.getByRole('region', { name: 'Ask Wise' })).toBeVisible();
		await expect(dock.getByRole('button', { name: 'Close Wise' })).toBeFocused();
		const narrow = (await dock.boundingBox())!.width;
		await dock.getByRole('button', { name: 'Expand Wise' }).click();
		await expect.poll(async () => (await dock.boundingBox())!.width).toBeGreaterThan(narrow);
		await dock.getByRole('button', { name: 'Close Wise' }).focus();
		await page.keyboard.press('Escape');
		await expect(dock).toBeHidden();
	});
});
