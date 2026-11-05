import { expect, test } from '@playwright/test';
import { DOCTOR, trackErrors } from './helpers';
import { logInAs, openLatestVisitOrders, requestTest, workTestAtLabDesk } from './lab-flow';

/**
 * A lab request end to end at the clinic's own lab: Dr. Reyes requests an HbA1c from Maria Santos's visit, the medtech
 * collects, runs, enters (flagged against the reference range) and releases it on the lab worklist, and the doctor
 * sees the released value on the visit.
 */
test.describe('lab orders', () => {
	test('doctor requests HbA1c, the lab works and releases it, the doctor sees the result', async ({ page }) => {
		const errors = trackErrors(page);
		const clinicalInfo = `E2E ${Date.now()}`;

		await logInAs(page, DOCTOR, '/patients');
		const visit = await openLatestVisitOrders(page, 'Maria Santos');
		await requestTest(page, 'Hemoglobin A1c', clinicalInfo);

		await workTestAtLabDesk(page, clinicalInfo, { HbA1c: '7.4' });

		await logInAs(page, DOCTOR, visit);
		await page.getByRole('tab', { name: /Orders/ }).click();
		const row = page.getByTestId('order-list').locator('tr', { hasText: clinicalInfo });
		await expect(row).toContainText('7.4 %');
		await expect(row).toContainText('High');
		await expect(row).toContainText('Released');
		expect(errors).toEqual([]);
	});
});
