import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { DOCTOR, logIn, trackErrors, USER } from './helpers';
import { logInAs } from './lab-flow';

/**
 * Settings → Clinic setup as the demo admin (test@test.test): profile, services and prices, practitioners with their
 * hours and leaves, numbering, expiring licenses and staff roles. Runs again on the same database: names carry a
 * run token, and what a test adds it removes.
 */
test.describe('clinic setup', () => {
	const run = Date.now().toString(36).toUpperCase();

	test('the clinic profile saves its registrations and PSGC address', async ({ page }) => {
		const errors = trackErrors(page);
		await logIn(page, '/settings/clinic/profile', USER);
		const clinic = page.getByRole('form', { name: 'Clinic' });
		await expect(clinic.getByLabel('Clinic name')).toHaveValue(/Tagbilaran/);
		await clinic.getByLabel('DOH License to Operate no.').fill(`SYN-LTO-${run}`);
		await clinic.getByLabel('Contact number').fill('(038) 000-0101');
		await expect(clinic.getByText('Tagbilaran', { exact: false }).first()).toBeVisible();
		await clinic.getByRole('button', { name: 'Save clinic' }).click();
		await expect(clinic.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();

		await page.reload();
		await expect(page.getByRole('form', { name: 'Clinic' }).getByLabel('DOH License to Operate no.')).toHaveValue(
			`SYN-LTO-${run}`,
		);
		await expect(page.getByRole('form', { name: 'Organization' }).getByLabel('TIN')).toHaveValue('000-123-456-000');
		expect(errors).toEqual([]);
	});

	test('an admin adds a service and gives it a clinic price', async ({ page }) => {
		const errors = trackErrors(page);
		const code = `E2E-${run}`;
		await logIn(page, '/settings/clinic/services', USER);
		await expect(page.getByRole('cell', { name: 'CONSULT', exact: true })).toBeVisible();

		await page.getByRole('button', { name: 'Add service' }).click();
		const dialog = page.getByRole('dialog');
		await dialog.getByLabel('Code').fill(code);
		await dialog.getByLabel('Name').fill(`E2E service ${run}`);
		await dialog.getByLabel('Default price (₱)').fill('250');
		await dialog.getByRole('button', { name: 'Add service' }).click();
		await expect(dialog).toBeHidden();

		await page.getByLabel('Search services').fill(code);
		const row = page.locator('tr', { hasText: code });
		await expect(row).toContainText('₱250.00');
		await row.getByRole('button', { name: /Clinic price of/ }).click();
		await page.getByRole('dialog').getByLabel('Clinic price (₱)').fill('199');
		await page.getByRole('dialog').getByLabel('HMO rate (₱)').fill('300');
		await page.getByRole('dialog').getByRole('button', { name: 'Save price' }).click();
		await expect(row).toContainText('₱199.00');
		await expect(row).toContainText('₱300.00');

		// Retire it so the demo price list stays as seeded.
		await row.getByRole('button', { name: /^Edit / }).click();
		await page.getByRole('dialog').getByText('Active (offered on invoices)').click();
		await page.getByRole('dialog').getByRole('button', { name: 'Save service' }).click();
		await expect(page.getByRole('dialog')).toBeHidden();
		await expect(page.locator('tr', { hasText: code })).toHaveCount(0);
		expect(errors).toEqual([]);
	});

	test('practitioners get clinic hours and a leave, and lose them again', async ({ page }) => {
		const errors = trackErrors(page);
		await logIn(page, '/settings/clinic/practitioners', USER);
		const cruz = page.getByRole('region', { name: /Cruz/ });
		await expect(cruz.getByRole('list', { name: /Clinic hours of/ })).toContainText(/\d{2}:\d{2}–\d{2}:\d{2}/);
		await expect(cruz.getByRole('list', { name: /Leaves of/ })).toContainText('PCP annual convention');

		await cruz.getByRole('button', { name: 'Add hours' }).click();
		const dialog = page.getByRole('dialog');
		await dialog.getByLabel('Day').click();
		await page.getByRole('option', { name: 'Friday' }).click();
		await dialog.getByRole('textbox', { name: 'From', exact: true }).fill('14:00');
		await dialog.getByRole('textbox', { name: 'Until', exact: true }).fill('16:00');
		await dialog.getByRole('button', { name: 'Add hours' }).click();
		await expect(dialog).toBeHidden();
		await expect(cruz.getByRole('list', { name: /Clinic hours of/ })).toContainText('Fri 14:00–16:00');

		// Overlapping hours are refused.
		await cruz.getByRole('button', { name: 'Add hours' }).click();
		await dialog.getByLabel('Day').click();
		await page.getByRole('option', { name: 'Friday' }).click();
		await dialog.getByRole('textbox', { name: 'From', exact: true }).fill('15:00');
		await dialog.getByRole('textbox', { name: 'Until', exact: true }).fill('17:00');
		await dialog.getByRole('button', { name: 'Add hours' }).click();
		await expect(dialog).toContainText('already holds clinic');
		await dialog.getByRole('button', { name: 'Cancel' }).click();

		await cruz.getByRole('button', { name: 'Add leave' }).click();
		await dialog.getByRole('textbox', { name: 'From', exact: true }).fill('2030-01-07');
		await dialog.getByLabel('Reason').fill(`E2E leave ${run}`);
		await dialog.getByRole('button', { name: 'Add leave' }).click();
		await expect(dialog).toBeHidden();
		await expect(cruz.getByRole('list', { name: /Leaves of/ })).toContainText(`E2E leave ${run}`);

		await cruz.getByRole('button', { name: /Remove leave .*2030/ }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
		await expect(cruz.getByRole('list', { name: /Leaves of/ })).not.toContainText(`E2E leave ${run}`);
		await cruz.getByRole('button', { name: 'Remove Fri 14:00–16:00' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
		await expect(cruz.getByRole('list', { name: /Clinic hours of/ })).not.toContainText('Fri 14:00–16:00');
		expect(errors).toEqual([]);
	});

	test('numbering shows the next number and refuses a prefix without the year', async ({ page }) => {
		const errors = trackErrors(page);
		await logIn(page, '/settings/clinic/numbering', USER);
		const row = page.locator('tr', { hasText: 'Prescription number' });
		const prefix = row.getByLabel('Prefix of Prescription number');
		const original = await prefix.inputValue();
		expect(original).toMatch(/\d{4}/);
		await prefix.fill('RX-');
		await expect(row).toContainText(/Put \d{4} in the prefix/);
		await expect(row.getByRole('button', { name: 'Save Prescription number' })).toBeDisabled();
		await prefix.fill(original);
		await row.getByLabel('Digits of Prescription number').fill('7');
		await expect(row).toContainText(new RegExp(`${original.replace(/[-/]/g, '\\$&')}\\d{7}`));
		expect(errors).toEqual([]);
	});

	test('expiring licenses and staff roles', async ({ page }) => {
		const errors = trackErrors(page);
		await logIn(page, '/settings/clinic/expiries', USER);
		const table = page.getByRole('table', { name: 'Expiring licenses' });
		await expect(table).toContainText('S2 license (PDEA)');
		await expect(table).toContainText('PhilHealth PAN');
		await expect(table).toContainText('Expired');

		await page.goto('/settings/clinic/staff');
		const nurseRow = page.locator('tr', { hasText: 'nurse.santos@loopwise.test' });
		await expect(nurseRow.getByRole('checkbox', { name: /^Nurse:/ })).toBeChecked();
		const frontDesk = nurseRow.getByRole('checkbox', { name: /^Front desk:/ });
		// Toggle twice from whatever state a previous run left, and end with the nurse back at the nurse desk only.
		const wasChecked = await frontDesk.isChecked();
		await frontDesk.click();
		await expect(frontDesk).toBeChecked({ checked: !wasChecked });
		if (!wasChecked) {
			await frontDesk.click();
		}
		await expect(frontDesk).not.toBeChecked();
		expect(errors).toEqual([]);
	});

	test('the setup screens pass axe (WCAG 2.2 AA, serious and critical)', async ({ page }) => {
		test.setTimeout(120_000);
		await logIn(page, '/settings/clinic/profile', USER);
		for (const screen of ['profile', 'practitioners', 'services', 'staff', 'numbering', 'expiries']) {
			await page.goto(`/settings/clinic/${screen}`);
			await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
			await page.waitForLoadState('networkidle');
			const results = await new AxeBuilder({ page })
				.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
				.analyze();
			const blocking = results.violations
				.filter((v) => v.impact === 'serious' || v.impact === 'critical')
				.map((v) => `${screen}: ${v.id} → ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
			expect(blocking, blocking.join('\n')).toEqual([]);
		}
	});

	test('a doctor without an admin role is kept out', async ({ page }) => {
		await logInAs(page, DOCTOR, '/settings/clinic/services');
		await expect(page).toHaveURL(/\/settings\/account/);
	});
});
