import { expect, test } from '@playwright/test';
import { DOCTOR, LAB_TECH, logIn, trackErrors } from './helpers';
import type { Page } from '@playwright/test';

/**
 * Wise actions (DESIGN.md §9.4) with a real LLM: the clinician asks in the chart chat, Wise drafts a card, and only
 * Confirm saves, through the same mutation as the page. Turning a tool off in Settings → Wise tools makes Wise say so.
 */
async function openChart(page: Page, name: string) {
	await page.goto('/patients');
	await page.getByLabel('Search patients').fill(name);
	const row = page.getByTestId('patient-list').getByRole('link').first();
	await expect(row).toContainText(name);
	await row.click();
	await expect(page.getByTestId('patient-name')).toBeVisible();
}

async function ask(page: Page, text: string) {
	const panel = page.getByRole('region', { name: 'Ask Wise' });
	await panel.locator('[contenteditable]').first().click();
	await page.keyboard.type(text);
	await page.keyboard.press('Enter');
	return panel;
}

/** The seed's DEV-ONLY Bohol Diagnostics key (synthetic), as the edge connector would send. */
const DEV_LAB_KEY = 'lw_dev_bohol_diagnostics_synthetic_key_0001';

/** A fresh synthetic HbA1c for Carmen Torres through the HL7 ingest, so there is always one to review. */
async function sendCarmenHbA1c(page: Page) {
	const id = `E2E-${Date.now().toString(36)}`;
	const now = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
	const message = [
		`MSH|^~\\&|BDL-LIS|BOHOL-DIAGNOSTICS|LOOPWISE|TAGBILARAN-HC|${now}||ORU^R01^ORU_R01|${id}|P|2.5.1`,
		'PID|1||SYN-0000-0006^^^PhilHealth^NH||Torres^Carmen||19751201|F',
		`ORC|RE||BDL-ACC-${id}`,
		`OBR|1||BDL-ACC-${id}|4548-4^Hemoglobin A1c^LN|||${now}|||||||||||||||${now}||CH|F`,
		`OBX|1|NM|4548-4^Hemoglobin A1c^LN||6.3|%^%^UCUM|4.0-5.6|H|||F|||${now}`,
	].join('\r');
	const res = await page.request.post('/api/hl7/messages', {
		headers: { Authorization: `Bearer ${DEV_LAB_KEY}`, 'Content-Type': 'text/plain' },
		data: message,
	});
	expect(await res.text()).toContain('MSA|AA');
}

async function setFacilityTool(page: Page, label: string, on: boolean) {
	await page.goto('/settings/wise-tools');
	const toggle = page.getByRole('switch', { name: new RegExp(`^${label} at `) });
	await expect(toggle).toBeVisible();
	if ((await toggle.isChecked()) !== on) {
		// Mantine's switch input is visually hidden behind its track: click its label.
		await toggle.locator('xpath=ancestor::label[1]').click();
		await expect(toggle).toBeChecked({ checked: on });
	}
}

test.describe('Wise actions', () => {
	test('records BP on a visit from chat, saved on Confirm (real LLM call)', async ({ page }) => {
		test.setTimeout(180_000);
		const errors = trackErrors(page);
		await logIn(page, '/patients');
		await openChart(page, 'Maria Santos');
		const panel = await ask(page, "Record BP 150/95 for Maria's latest visit.");

		const card = panel.getByTestId('propose-vitals').last();
		await expect(card.getByTestId('drafted-vitals')).toContainText('BP 150/95', { timeout: 120_000 });
		await card.getByRole('button', { name: 'Save vitals' }).click();
		await expect(card).toContainText('Vitals recorded');
		expect(errors).toEqual([]);
	});

	test('orders HbA1c at Bohol Diagnostics from chat (real LLM call)', async ({ page }) => {
		test.setTimeout(180_000);
		const errors = trackErrors(page);
		await logIn(page, '/patients');
		await openChart(page, 'Maria Santos');
		const panel = await ask(
			page,
			'Order a new HbA1c at Bohol Diagnostics for her latest visit (a repeat order is fine, do not ask).',
		);

		const card = panel.getByTestId('propose-order').last();
		await expect(card.getByTestId('drafted-tests')).toContainText('Hemoglobin A1c', { timeout: 120_000 });
		await expect(card.getByLabel('Send to')).toHaveValue(/.+/);
		await card.getByRole('button', { name: 'Order test' }).click();
		await expect(card).toContainText('Ordered');
		expect(errors).toEqual([]);
	});

	test('lists a result to review and reviews it from its card (real LLM call)', async ({ page }) => {
		test.setTimeout(240_000);
		const errors = trackErrors(page);
		await sendCarmenHbA1c(page);
		await logIn(page, '/patients', DOCTOR);
		await openChart(page, 'Carmen Torres');
		const panel = await ask(
			page,
			'Any results for me to review? If there is one, draft its review with the note "Discussed at follow-up".',
		);

		// The list is a read, folded under "Explored"; Wise cites it in its reply.
		await expect(panel.getByText(/HbA1c/).last()).toBeVisible({ timeout: 120_000 });
		const card = panel.getByTestId('propose-result-review').last();
		await expect(card.getByTestId('review-result')).toContainText('Hemoglobin A1c', { timeout: 120_000 });
		await card.getByRole('button', { name: /^Mark (critical result )?reviewed$/ }).click();
		const yes = card.getByRole('button', { name: /^Yes, / });
		if (await yes.isVisible()) {
			await yes.click();
		}
		await expect(card).toContainText('Reviewed');
		expect(errors).toEqual([]);
	});

	test('adds a diagnosis to her latest visit from chat (real LLM call)', async ({ page }) => {
		test.setTimeout(180_000);
		const errors = trackErrors(page);
		await logIn(page, '/patients');
		await openChart(page, 'Maria Santos');
		const panel = await ask(page, 'Add a provisional diagnosis of obesity, E66.9, to her latest visit.');

		const card = panel.getByTestId('propose-diagnosis').last();
		await expect(card.getByTestId('drafted-diagnosis')).toContainText('E66.9', { timeout: 120_000 });
		await card.getByRole('button', { name: /^(Add diagnosis|Save changes)$/ }).click();
		await expect(card).toContainText(/Diagnosis (added|updated)/);
		expect(errors).toEqual([]);
	});

	test('the lab accepts an order from its worklist in chat (real LLM call)', async ({ page }) => {
		test.setTimeout(180_000);
		const errors = trackErrors(page);
		// Incoming orders for Bohol Diagnostics: the order flow above sends one each run.
		await logIn(page, '/orders', LAB_TECH);
		await page.getByRole('button', { name: 'Ask Wise' }).first().click();
		const panel = page.getByRole('region', { name: 'Ask Wise' });
		await panel.locator('[contenteditable]').first().click();
		await page.keyboard.type('What is on our worklist? Accept the oldest incoming order.');
		await page.keyboard.press('Enter');

		const card = panel.getByTestId('propose-lab-order-step').last();
		await expect(card).toBeVisible({ timeout: 120_000 });
		await card.getByRole('button', { name: 'Accept order' }).click();
		await expect(card).toContainText('Done');
		expect(errors).toEqual([]);
	});

	test('declines an action turned off in Settings → Wise tools (real LLM call)', async ({ page }) => {
		test.setTimeout(180_000);
		await logIn(page, '/settings/wise-tools');
		await setFacilityTool(page, 'Record vitals', false);
		try {
			await openChart(page, 'Maria Santos');
			const cards = page.getByRole('region', { name: 'Ask Wise' }).getByTestId('propose-vitals');
			// The chart chat keeps earlier turns: once they have loaded, no new card may appear.
			await page.waitForLoadState('networkidle');
			const before = await cards.count();
			const panel = await ask(page, "Record BP 150/95 for Maria's latest visit.");
			await expect(panel.getByText(/turned off/i).last()).toBeVisible({ timeout: 120_000 });
			await expect(cards).toHaveCount(before);
		} finally {
			await setFacilityTool(page, 'Record vitals', true);
		}
	});
});
