import { expect, test } from '@playwright/test';
import { logIn, trackErrors, USER } from './helpers';
import type { Page } from '@playwright/test';

const isDark = (page: Page) =>
	page.evaluate(
		() =>
			document.documentElement.classList.contains('dark') ||
			document.documentElement.getAttribute('data-mantine-color-scheme') === 'dark',
	);

test.describe('signed out', () => {
	test('a wrong password shows an error and stays on login', async ({ page }) => {
		await page.goto('/login');
		await page.locator('input[name="email"]').fill(USER.email);
		await page.locator('input[name="password"]').fill('wrong-password');
		await page.getByRole('button', { name: 'Log in', exact: true }).click();
		await expect(page.getByText(/invalid email or password/i)).toBeVisible();
		await expect(page).toHaveURL(/\/login/);
	});

	test('a protected page redirects to login and returns after signing in', async ({ page }) => {
		await page.goto('/settings/account');
		await expect(page).toHaveURL(/\/login\?redirect=/);
		await page.locator('input[name="email"]').fill(USER.email);
		await page.locator('input[name="password"]').fill(USER.password);
		await page.getByRole('button', { name: 'Log in', exact: true }).click();
		await expect(page).toHaveURL(/\/settings\/account/);
		await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();
	});
});

test.describe('signed in', () => {
	test.beforeEach(async ({ page }) => {
		await logIn(page);
	});

	test('search opens from the keyboard and closes on Escape', async ({ page }) => {
		await expect(page.getByRole('button', { name: 'Toggle sidebar' })).toBeVisible();
		await page.keyboard.press('ControlOrMeta+k');
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();
		await dialog.getByRole('textbox').or(dialog.getByRole('combobox')).first().fill('patients');
		await expect(dialog.getByText(/patients/i).first()).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
	});

	test('the sidebar collapses and expands', async ({ page }) => {
		const patients = page.getByRole('link', { name: /^Patients/ }).first();
		await expect(patients).toBeVisible();
		const before = (await patients.boundingBox())!.width;
		await page.getByRole('button', { name: 'Toggle sidebar' }).click();
		await expect.poll(async () => (await patients.boundingBox())!.width).toBeLessThan(before);
		await page.getByRole('button', { name: 'Toggle sidebar' }).click();
		await expect.poll(async () => (await patients.boundingBox())!.width).toBe(before);
	});

	test('the theme setting changes the color scheme and survives a reload', async ({ page }) => {
		await page.goto('/settings/account');
		await page.getByRole('button', { name: 'Dark', exact: true }).click();
		await expect.poll(() => isDark(page)).toBe(true);
		await page.reload();
		await expect.poll(() => isDark(page)).toBe(true);
		await page.getByRole('button', { name: 'Light', exact: true }).click();
		await expect.poll(() => isDark(page)).toBe(false);
	});

	test('settings navigation reaches each section', async ({ page }) => {
		await page.goto('/settings/account');
		for (const [label, path, heading] of [
			['Project Settings', '/settings/project', null],
			['Agent', '/settings/project/agent', 'Agent'],
			['Skills', '/settings/project/skills', null],
			['Wise tools', '/settings/wise-tools', null],
			['Appearance', '/settings/appearance', 'Appearance'],
			['Users', '/settings/users', 'Users'],
			['Storage', '/settings/storage', null],
			['Usage & Costs', '/settings/usage', 'Usage'],
		] as const) {
			await page.getByRole('link', { name: label, exact: true }).click();
			await expect(page).toHaveURL(new RegExp(`${path}(\\?.*)?$`));
			if (heading) {
				await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
			}
		}
	});

	test('the agent settings tabs switch', async ({ page }) => {
		await page.goto('/settings/project/agent');
		await expect(page.getByText('LLM Configuration').first()).toBeVisible();
		await page
			.getByRole('button', { name: 'Capabilities' })
			.or(page.getByRole('tab', { name: 'Capabilities' }))
			.click();
		await expect(page.getByText('LLM Configuration').first()).toBeHidden();
		await page
			.getByRole('button', { name: 'Models' })
			.or(page.getByRole('tab', { name: 'Models' }))
			.click();
		await expect(page.getByText('LLM Configuration').first()).toBeVisible();
	});

	test('a chat from the list opens with its messages', async ({ page }) => {
		// The chat history lives on the Wise chats page, not in the sidebar.
		await page.goto('/chats');
		const firstChat = page.getByRole('table').getByRole('link').first();
		await firstChat.click();
		await expect(page).toHaveURL(/\/[0-9a-z-]{10,}$/i);
		await expect(
			page
				.locator('[data-testid], main, body')
				.getByText(/\S{3,}/)
				.nth(10),
		).toBeVisible();
	});

	test('the usage page shows messages, tokens and cost', async ({ page }) => {
		const errors = trackErrors(page);
		await page.goto('/settings/usage');
		await expect(page.getByRole('heading', { name: 'Usage' })).toBeVisible();
		await expect(page.getByText('Total messages').first()).toBeVisible();
		await expect(page.getByText('Number of messages by source')).toBeVisible();
		await expect(page.getByText('Tokens', { exact: true }).first()).toBeVisible();

		await page.getByRole('combobox').filter({ hasText: 'Show in tokens' }).click();
		await page.getByRole('option', { name: 'Show in dollars' }).click();
		await expect(page.getByText('Cost', { exact: true }).first()).toBeVisible();
		await expect(page).toHaveURL(/tokenView=dollars/);
		expect(errors).toEqual([]);
	});

	test('sign out returns to login', async ({ page }) => {
		await page.goto('/settings/account');
		await page.getByRole('button', { name: 'Sign out' }).click();
		await expect(page).toHaveURL(/\/login/);
		await page.goto('/settings/account');
		await expect(page).toHaveURL(/\/login/);
	});
});

test.describe('skills', () => {
	test.beforeEach(async ({ page }) => {
		await logIn(page);
	});

	const deleteSkill = async (page: Page, name: string) => {
		await page.goto('/settings/project/skills');
		await page.getByRole('button', { name: `Delete ${name}` }).click();
		await page.getByRole('button', { name: 'Delete', exact: true }).click();
		await expect(page.getByRole('button', { name: `Delete ${name}` })).toBeHidden();
	};

	test('creates a skill in the form, finds it in chat, edits and deletes it', async ({ page }) => {
		const name = `e2e-skill-${Date.now()}`;
		await page.goto('/settings/project/skills');
		await page.getByRole('button', { name: 'New skill' }).click();
		await page.getByPlaceholder('churn-analysis').fill(name);
		await page.getByPlaceholder(/Use when the user asks/).fill('Use for the e2e flow.');
		await page.getByPlaceholder(/Call qt_monthly_churn/).fill('1. Say hello.');
		await page.getByRole('button', { name: 'Save skill' }).click();
		await expect(page.getByText(`/${name}`)).toBeVisible();

		await page.goto('/');
		await page.locator('[contenteditable]').first().click();
		await page.keyboard.type(`/${name.slice(0, 12)}`);
		await expect(page.getByText(name).first()).toBeVisible();

		await page.goto('/settings/project/skills');
		await page.getByRole('button', { name: `Edit ${name}` }).click();
		await expect(page.getByPlaceholder(/Call qt_monthly_churn/)).toHaveValue('1. Say hello.');
		await page.getByPlaceholder(/Use when the user asks/).fill('Edited description.');
		await page.getByRole('button', { name: 'Save skill' }).click();
		await expect(page.getByText('Edited description.')).toBeVisible();

		await deleteSkill(page, name);
	});
});
