import { expect } from '@playwright/test';
import { LAB_TECH, logIn, USER } from './helpers';
import type { Page } from '@playwright/test';

/** Signs out (clears the session) and signs in as `user`, landing on `redirect`. */
export async function logInAs(page: Page, user: { email: string; password: string }, redirect = '/') {
	await page.context().clearCookies();
	await logIn(page, redirect, user);
}

/** Opens the patient's latest visit on its Orders tab, as the signed-in clinician; returns the visit's path. */
export async function openLatestVisitOrders(page: Page, patient: string): Promise<string> {
	await page.goto('/patients');
	await page.getByLabel('Search patients').fill(patient);
	await page
		.getByTestId('patient-list')
		.getByRole('link', { name: new RegExp(patient) })
		.first()
		.click();
	await page.getByTestId('encounter-list').getByRole('link').first().click();
	const path = new URL(page.url()).pathname;
	await page.getByRole('tab', { name: /Orders/ }).click();
	return path;
}

/** Requests one test from the open Orders tab, with `clinicalInfo` to tell this run's order apart. */
export async function requestTest(page: Page, test: string, clinicalInfo: string) {
	await page.getByRole('checkbox', { name: new RegExp(test) }).check();
	await page.getByLabel('Clinical information').fill(clinicalInfo);
	await page.getByRole('button', { name: 'Request test' }).click();
	await expect(page.getByTestId('order-list').locator('tr', { hasText: clinicalInfo })).toContainText('Requested');
}

/**
 * The lab desk works the test through every step as the medtech: collect, start, enter `values` (by analyte label)
 * and release. The row is found by the order's clinical information.
 */
export async function workTestAtLabDesk(page: Page, clinicalInfo: string, values: Record<string, string>) {
	await logInAs(page, LAB_TECH, '/orders');
	await expect(page.getByRole('heading', { name: 'Lab worklist' })).toBeVisible();
	const row = () => page.getByTestId('lab-order-row').filter({ hasText: clinicalInfo });

	await expect(row()).toContainText('Requested');
	await row()
		.getByRole('button', { name: /collected$/ })
		.click();
	await expect(row()).toHaveCount(0);

	await page.getByRole('tab', { name: /Collected/ }).click();
	await row()
		.getByRole('button', { name: /^Start / })
		.click();
	await expect(row()).toHaveCount(0);

	await page.getByRole('tab', { name: /In progress/ }).click();
	await row()
		.getByRole('button', { name: /^Enter the result/ })
		.click();
	const dialog = page.getByRole('dialog');
	for (const [label, value] of Object.entries(values)) {
		await dialog.getByLabel(new RegExp(`^${label}( \\(|$)`)).fill(value);
	}
	await dialog.getByRole('button', { name: 'Save result' }).click();
	await expect(dialog).toBeHidden();

	await page.getByRole('tab', { name: /To release/ }).click();
	await expect(row()).toContainText('Resulted');
	await row()
		.getByRole('button', { name: /^Release / })
		.click();
	await expect(row()).toHaveCount(0);
}

/** A fresh released HbA1c for `patient`, requested by the admin doctor: there is always one to review. */
export async function releasedHbA1c(page: Page, patient: string, value: string): Promise<string> {
	const clinicalInfo = `E2E ${Date.now().toString(36)}`;
	await logInAs(page, USER, '/patients');
	await openLatestVisitOrders(page, patient);
	await requestTest(page, 'Hemoglobin A1c', clinicalInfo);
	await workTestAtLabDesk(page, clinicalInfo, { HbA1c: value });
	return clinicalInfo;
}
