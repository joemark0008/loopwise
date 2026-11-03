import { expect, test } from '@playwright/test';
import { logIn, selectProjectWithWarehouse, trackErrors, USER } from './helpers';
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
		await dialog.getByRole('textbox').or(dialog.getByRole('combobox')).first().fill('booking');
		await expect(dialog.getByText(/booking/i).first()).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
	});

	test('the sidebar collapses and expands', async ({ page }) => {
		const stories = page.getByRole('button', { name: /^Stories/ });
		await expect(stories).toBeVisible();
		const before = (await stories.boundingBox())!.width;
		await page.getByRole('button', { name: 'Toggle sidebar' }).click();
		await expect.poll(async () => (await stories.boundingBox())!.width).toBeLessThan(before);
		await page.getByRole('button', { name: 'Toggle sidebar' }).click();
		await expect.poll(async () => (await stories.boundingBox())!.width).toBe(before);
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
			['Warehouse', '/settings/project/warehouse', 'Warehouse'],
			['Agent', '/settings/project/agent', 'Agent'],
			['Query tools', '/settings/project/query-tools', null],
			['Appearance', '/settings/appearance', 'Appearance'],
			['Recommendations', '/settings/recommendations', null],
			['File Explorer', '/settings/context-explorer', null],
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

	test('the stories page opens the new folder dialog', async ({ page }) => {
		await page.getByRole('button', { name: /^Stories/ }).click();
		await expect(page).toHaveURL(/\/stories/);
		await page.getByRole('button', { name: 'New folder' }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
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

	test('sending a message gets an answer from the agent', async ({ page }) => {
		test.setTimeout(180_000);
		const errors = trackErrors(page);
		const prompt = page.locator('[contenteditable]').first();
		await prompt.click();
		await page.keyboard.type('Reply with exactly the word PONG and do not use any tools.');
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(/\/[0-9a-z-]{10,}$/i, { timeout: 60_000 });
		await expect(page.getByText('PONG', { exact: true }).first()).toBeVisible({ timeout: 120_000 });
		expect(errors).toEqual([]);
		await page.reload();
		await expect(page.getByText('PONG', { exact: true }).first()).toBeVisible();
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

test.describe('query workbench', () => {
	test.beforeEach(async ({ page }) => {
		await logIn(page);
		test.skip(!(await selectProjectWithWarehouse(page)), 'needs a project with a warehouse connection');
	});

	/** Through Monaco's API: Playwright's ⌘ shortcuts don't reach it in headless Chromium on macOS. */
	const runEditorAction = (page: Page, action: string) =>
		page.evaluate((id) => {
			(window as any).monaco.editor.getEditors()[0].trigger('e2e', id, null);
		}, action);

	const typeSql = async (page: Page, sql: string) => {
		await page.getByTestId('query-tool-sql-editor').locator('.view-lines').click();
		await runEditorAction(page, 'editor.action.selectAll');
		await page.keyboard.type(sql);
	};

	test('runs a query first, then saves it as a tool', async ({ page }) => {
		const name = `e2e_orders_${Date.now()}`;
		await page.goto('/settings/project/query-tools');
		await page.getByRole('button', { name: 'New query' }).click();
		await expect(page).toHaveURL(/tool=new/);

		await typeSql(page, 'SELECT 1 AS one');
		await page.getByRole('button', { name: 'Run', exact: true }).click();
		await expect(page.getByTestId('query-tool-preview')).toContainText('1 row');

		await page.reload();
		await expect(page.getByTestId('query-tool-sql-editor')).toContainText('SELECT 1 AS one');

		await page.getByRole('button', { name: 'Save as tool' }).click();
		await page.getByPlaceholder('orders_by_status').fill(name);
		await page.getByPlaceholder(/What the query returns/).fill('One row, from the e2e flow.');
		await page.getByRole('button', { name: 'Save tool' }).click();
		await expect(page.getByRole('heading', { name: `qt_${name}` })).toBeVisible();
		await expect(page).toHaveURL(/tool=(?!new)/);

		await typeSql(page, 'SELECT 2 AS two');
		await expect(page.getByText('Unsaved changes')).toBeVisible();
		await page.getByRole('button', { name: 'Update', exact: true }).click();
		await expect(page.getByText('Unsaved changes')).toBeHidden();
		await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();

		await page.getByRole('button', { name: 'Back to query tools' }).click();
		await page.getByRole('button', { name: `Delete ${name}` }).click();
		await page.getByRole('button', { name: 'Delete', exact: true }).click();
		await expect(page.getByRole('button', { name: `Delete ${name}` })).toBeHidden();
	});

	test('a failed run offers the assistant', async ({ page }) => {
		await page.goto('/settings/project/query-tools?tool=new');
		await page.getByRole('button', { name: 'New draft' }).click();
		await typeSql(page, 'SELECT missing_column FROM missing_table');
		await page.getByRole('button', { name: 'Run', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Ask assistant to fix' })).toBeVisible();
	});

	test('the assistant proposes a tested query that the user applies (real LLM call)', async ({ page }) => {
		await page.goto('/settings/project/query-tools?tool=new');
		await page.getByRole('button', { name: 'New draft' }).click();
		await page.getByPlaceholder('Ask for a query…').fill('How many orders are there in total?');
		await page.getByPlaceholder('Ask for a query…').press('Enter');

		const card = page.getByTestId('propose-sql');
		await expect(card).toBeVisible({ timeout: 120_000 });
		await expect(page.getByTestId('query-tool-sql-editor')).not.toContainText('SELECT');
		await card.getByRole('button', { name: 'Apply to editor' }).click();
		await expect(page.getByTestId('query-tool-sql-editor')).toContainText('SELECT');

		await runEditorAction(page, 'undo');
		await expect(page.getByTestId('query-tool-sql-editor')).not.toContainText('SELECT');
		await card.getByRole('button', { name: 'Apply to editor' }).click();
		await expect(page.getByTestId('query-tool-sql-editor')).toContainText('SELECT');

		await page.getByRole('button', { name: 'Run', exact: true }).click();
		await expect(page.getByTestId('query-tool-preview')).toBeVisible();

		await page.reload();
		await expect(page.getByTestId('propose-sql')).toBeVisible();
		await expect(page.getByTestId('propose-sql').getByRole('button', { name: 'In the editor' })).toBeVisible();

		await page.goto('/');
		await expect(page.getByText('How many orders are there in total?')).toBeHidden();
	});
});

test.describe('skills', () => {
	test.beforeEach(async ({ page }) => {
		await logIn(page);
		test.skip(!(await selectProjectWithWarehouse(page)), 'needs a project with a warehouse connection');
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

	test('the assistant drafts a skill from a query and the user saves it (real LLM call)', async ({ page }) => {
		test.setTimeout(180_000);
		await page.goto('/settings/project/query-tools?tool=new');
		await page.getByRole('button', { name: 'New draft' }).click();
		await page.getByTestId('query-tool-sql-editor').locator('.view-lines').click();
		await page.keyboard.type('SELECT count(*) AS order_count FROM public.orders');
		await page.getByRole('button', { name: 'Create skill' }).click();

		const card = page.getByTestId('propose-skill');
		await expect(card).toBeVisible({ timeout: 120_000 });
		const saved = (await card.getByText(/^\/[a-z0-9-]+$/).innerText()).slice(1);
		await expect(page.getByRole('button', { name: 'Save skill' })).toBeEnabled({ timeout: 30_000 });
		await page.getByRole('button', { name: 'Save skill' }).click();
		await expect(card.getByText('Saved', { exact: true })).toBeVisible({ timeout: 30_000 });

		await page.goto('/settings/project/skills');
		await page.getByRole('button', { name: `Edit ${saved}` }).click();
		const instructions = page.getByPlaceholder(/Call qt_monthly_churn/);
		await expect(instructions).toHaveValue(/order/i);
		expect((await instructions.inputValue()).length).toBeGreaterThan(40);
		await page.getByRole('button', { name: 'Cancel' }).click();

		await deleteSkill(page, saved);
	});
});
