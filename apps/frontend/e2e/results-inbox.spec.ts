import { expect, test } from '@playwright/test';
import { logIn, trackErrors } from './helpers';

/** The seed's DEV-ONLY facility key for the bohol-diagnostics lab (`prisma/seed-facility-keys.ts`). */
const DEV_LAB_KEY = process.env.LOOPWISE_FACILITY_KEY ?? 'lw_dev_bohol_diagnostics_synthetic_key_0001';

/** A synthetic ORU^R01 for the seeded Maria Santos (THC-0001 / SYN-0000-0001): one HbA1c value. */
function mariaHbA1c(controlId: string, value: string): string {
	return [
		`MSH|^~\\&|BDL-LIS|BOHOL-DIAGNOSTICS|LOOPWISE|TAGBILARAN-HC|20261106093000+0800||ORU^R01^ORU_R01|${controlId}|P|2.5.1`,
		'PID|1||THC-0001^^^THC^MR~SYN-0000-0001^^^PhilHealth^NH||Santos^Maria||19810412|F',
		'OBR|1||BDL-ACC-1|4548-4^Hemoglobin A1c^LN|||20261106080000+0800',
		`OBX|1|NM|4548-4^Hemoglobin A1c^LN||${value}|%^%^UCUM|4.0-5.6|H|||F|||20261106092000+0800`,
	].join('\r');
}

test.describe('results inbox', () => {
	test('a result posted over HL7 appears in the inbox and is marked reviewed', async ({ page }) => {
		const errors = trackErrors(page);
		const unique = Date.now().toString(36);
		// A value no other result has, so the row is unambiguous: 7.10–7.99.
		const value = `7.${10 + (Date.now() % 90)}`;

		const res = await page.request.post('/api/hl7/messages', {
			headers: { Authorization: `Bearer ${DEV_LAB_KEY}`, 'Content-Type': 'text/plain' },
			data: mariaHbA1c(`E2E-${unique}`, value),
		});
		expect(res.status()).toBe(200);
		expect(await res.text()).toContain(`MSA|AA|E2E-${unique}`);

		await logIn(page, '/results');
		await expect(page.getByRole('heading', { name: 'Results to review' })).toBeVisible();
		const row = page.getByTestId('result-row').filter({ hasText: `${value} %` });
		await expect(row).toHaveCount(1);
		await expect(row).toContainText('Maria Santos');
		await expect(row).toContainText('High');
		const chartLink = row.getByRole('link', { name: 'Maria Santos' });
		await expect(chartLink).toHaveAttribute('href', /\/patients\/.+\/results$/);
		const chartPath = (await chartLink.getAttribute('href')) ?? '';

		await row.getByRole('button', { name: 'Mark reviewed' }).click();
		const dialog = page.getByRole('dialog');
		await dialog.getByLabel('Note (optional)').fill('Diabetes range; discuss at follow-up');
		await dialog.getByRole('button', { name: 'Mark reviewed' }).click();
		await expect(dialog).toBeHidden();
		await expect(row).toHaveCount(0);

		// The chart's Results tab keeps it, now reviewed.
		await page.goto(chartPath);
		await expect(page.getByTestId('patient-name')).toContainText('Maria Santos');
		const charted = page.getByTestId('result-row').filter({ hasText: `${value} %` });
		await expect(charted).toContainText('Reviewed');
		expect(errors).toEqual([]);
	});
});
