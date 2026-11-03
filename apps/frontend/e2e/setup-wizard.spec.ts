import { expect, test } from '@playwright/test';

/**
 * Needs an empty database and the token the API derives from BETTER_AUTH_SECRET, so it only runs
 * from `npm run test:e2e:setup`, which sets SETUP_E2E_TOKEN. Against the seeded stack it is skipped.
 */
const token = process.env.SETUP_E2E_TOKEN;
const ADMIN = { name: 'Wizard Admin', email: 'wizard-admin@example.test', password: 'wizard-pass-1234' };

test.skip(!token, 'SETUP_E2E_TOKEN is not set (run npm run test:e2e:setup)');

test('install wizard creates the first admin and closes sign-up', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/setup$/);
	await page.goto('/login');
	await expect(page).toHaveURL(/\/setup$/);

	await expect(page.getByLabel('Setup token')).toBeVisible();
	await expect(page.getByText(/logs loopwise \| grep "setup token"/)).toBeVisible();
	await page.locator('input[name="token"]').fill('not-the-token');
	await page.locator('input[name="name"]').fill(ADMIN.name);
	await page.locator('input[name="email"]').fill(ADMIN.email);
	await page.locator('input[name="password"]').fill(ADMIN.password);
	await page.getByRole('button', { name: 'Create admin account' }).click();
	await expect(page.getByText('Invalid setup token.')).toBeVisible();
	await expect(page.locator('input[name="name"]')).toHaveValue(ADMIN.name);
	await expect(page.locator('input[name="email"]')).toHaveValue(ADMIN.email);

	await page.locator('input[name="token"]').fill(token!);
	await page.getByRole('button', { name: 'Create admin account' }).click();
	await expect(page).not.toHaveURL(/\/(setup|login)/);
	await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
	await page.reload();
	await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
	await expect(page).not.toHaveURL(/\/(setup|login)/);

	await page.goto('/setup');
	await expect(page).not.toHaveURL(/\/setup/);

	await page.getByRole('button', { name: 'Account menu' }).click();
	await page.getByRole('menuitem', { name: 'Sign out' }).click();
	await expect(page).toHaveURL(/\/login/);
	await page.goto('/setup');
	await expect(page).toHaveURL(/\/login/);
	await expect(page.locator('a[href*="signup"]')).toHaveCount(0);

	// There is no sign-up route: a signed-out visit to an old bookmark lands on the login page, without
	// carrying /signup along as a post-login redirect.
	await page.goto('/signup');
	await expect(page).toHaveURL(/\/login$/);
	await expect(page.locator('input[name="email"]')).toBeVisible();
	await expect(page.locator('input[name="token"]')).toHaveCount(0);
	await expect(page.getByRole('button', { name: /sign up|create account|create admin account/i })).toHaveCount(0);
});
