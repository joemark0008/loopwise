import { expect, test } from '@playwright/test';
import { logIn, trackErrors } from './helpers';
import type { Browser, Page } from '@playwright/test';

/** Each run adds a new user to the seeded database; the email keeps runs apart. */
const runId = Date.now();
const member = { name: `E2E Member ${runId}`, email: `e2e-member-${runId}@example.com` };

async function readIssuedLink(page: Page, title: string): Promise<string> {
	const dialog = page.getByRole('dialog', { name: title });
	const url = await dialog.getByLabel('Password link').inputValue();
	expect(url).toContain('/set-password?token=');
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	return url;
}

/** Opens a set-password link in a fresh browser context, as the user would. */
async function usePasswordLink(browser: Browser, url: string, heading: string, password: string) {
	const context = await browser.newContext();
	const page = await context.newPage();
	const errors = trackErrors(page);
	await page.goto(url);
	await expect(page.getByRole('heading', { name: heading })).toBeVisible();
	await page.locator('input[name="password"]').fill(password);
	await page.locator('input[name="confirmPassword"]').fill(password);
	await page.getByRole('button', { name: /and log in$/ }).click();
	await page.waitForURL((u) => u.pathname === '/');
	expect(errors).toEqual([]);
	return { context, page };
}

test('an admin creates a user, who sets a password, is reset, and changes it', async ({ page, browser }) => {
	test.setTimeout(120_000);
	await logIn(page, '/settings/account');

	await page.getByRole('link', { name: 'Users', exact: true }).click();
	await expect(page).toHaveURL(/\/settings\/users$/);
	await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();

	await page.getByRole('button', { name: 'Add user' }).click();
	await page.locator('input[name="name"]').fill(member.name);
	await page.locator('input[name="email"]').fill(member.email);
	await page.getByRole('button', { name: 'Create user' }).click();
	const inviteUrl = await readIssuedLink(page, 'Invite link');
	const row = page.getByText(member.email).locator('xpath=ancestor::div[2]');
	await expect(row.getByText('Invited')).toBeVisible();

	const first = await usePasswordLink(browser, inviteUrl, 'Welcome to Loopwise', 'First-pass1');
	await first.context.close();

	await page.reload();
	await expect(row.getByText('Active')).toBeVisible();
	await page.getByRole('button', { name: `Actions for ${member.name}` }).click();
	await page.getByRole('menuitem', { name: 'Reset password' }).click();
	const resetUrl = await readIssuedLink(page, 'Password reset link');

	const reset = await usePasswordLink(browser, resetUrl, 'Reset your password', 'Second-pass2');
	await reset.page.goto('/settings/account');
	await reset.page.getByRole('button', { name: 'Change password' }).click();
	const dialog = reset.page.getByRole('dialog');
	await dialog.locator('input[name="currentPassword"]').fill('Second-pass2');
	await dialog.locator('input[name="newPassword"]').fill('Third-pass3');
	await dialog.locator('input[name="confirmPassword"]').fill('Third-pass3');
	await dialog.getByRole('button', { name: 'Change password' }).click();
	await expect(reset.page.getByText('Password changed.')).toBeVisible();
	await reset.context.close();

	// Leave the seeded database with the test user unable to log in.
	await page.getByRole('button', { name: `Actions for ${member.name}` }).click();
	await page.getByRole('menuitem', { name: 'Deactivate' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Deactivate' }).click();
	await expect(row.getByText('Deactivated')).toBeVisible();
});

test('an invalid set-password link says so', async ({ page }) => {
	await page.goto('/set-password?token=not-a-real-token');
	await expect(page.getByRole('heading', { name: 'Invalid or expired link' })).toBeVisible();
});
