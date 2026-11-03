import { expect, test } from '@playwright/test';
import { logIn, trackErrors } from './helpers';

/** A synthetic patient no earlier run registered (the development database keeps them). */
const uniquePatient = () => {
	const run = Date.now().toString(36).toUpperCase();
	return { givenName: 'Rosa', familyName: `Testcase${run.toLowerCase()}`, mrn: `THC-E2E-${run}` };
};

test.describe('patient registration', () => {
	test.beforeEach(async ({ page }) => {
		await logIn(page, '/patients');
	});

	test('registers a patient in the form, then finds them in the list', async ({ page }) => {
		const errors = trackErrors(page);
		const patient = uniquePatient();
		await page.getByRole('link', { name: 'Register patient' }).click();
		await expect(page.getByRole('heading', { name: 'Register a patient' })).toBeVisible();

		await page.getByRole('button', { name: 'Register patient' }).click();
		// The error summary takes focus and lists the problem; the field shows it too.
		await expect(page.getByRole('alert')).toContainText('Add the given name.');
		await expect(page.getByLabel('Given name')).toHaveAccessibleDescription('Add the given name.');

		await page.getByLabel('Given name').fill(patient.givenName);
		await page.getByLabel('Family name').fill(patient.familyName);
		await page.getByLabel('Birth date').fill('1990-07-15');
		await page.getByRole('combobox', { name: 'Sex' }).click();
		await page.getByRole('option', { name: 'Female' }).click();
		await page.getByLabel('MRN').fill(patient.mrn);
		await page.getByLabel('Mobile number').fill('0917 000 1234');
		await page.getByLabel('Consent').check();
		await page.getByRole('button', { name: 'Register patient' }).click();

		await expect(page.getByTestId('patient-name')).toHaveText(`${patient.givenName} ${patient.familyName}`);
		// Contact details sit in the chart's collapsible Patient details.
		await page.getByText('Patient details').click();
		await expect(page.getByText('+639170001234')).toBeVisible();

		await page.getByRole('link', { name: 'Patients' }).first().click();
		await page.getByLabel('Search patients').fill(patient.mrn);
		await expect(page.getByTestId('patient-list').getByText(patient.familyName)).toBeVisible();
		expect(errors).toEqual([]);
	});

	test('warns about a patient already registered with the same identifier', async ({ page }) => {
		await page.goto('/patients/new');
		await page.getByLabel('Given name').fill('Maria');
		await page.getByLabel('Family name').fill('Santos');
		await page.getByLabel('Birth date').fill('1981-04-12');
		await page.getByRole('combobox', { name: 'Sex' }).click();
		await page.getByRole('option', { name: 'Female' }).click();
		await page.getByLabel('MRN').fill('THC-0001');
		await page.getByLabel('Consent').check();
		await page.getByRole('button', { name: 'Register patient' }).click();
		await expect(page.getByTestId('duplicate-alert')).toContainText('This patient is already registered');
		await expect(page.getByTestId('duplicate-alert')).toContainText('MRN THC-0001');
	});

	test('Wise drafts the registration and the clinician confirms it (real LLM call)', async ({ page }) => {
		test.setTimeout(180_000);
		const patient = uniquePatient();
		await page.goto('/');
		const prompt = page.locator('[contenteditable]').first();
		await prompt.click();
		await page.keyboard.type(
			`Register a new patient: ${patient.givenName} ${patient.familyName}, female, born 1990-07-15, MRN ${patient.mrn}.`,
		);
		await page.keyboard.press('Enter');

		const card = page.getByTestId('propose-patient-registration');
		await expect(card).toContainText(patient.familyName, { timeout: 120_000 });
		await expect(card).toContainText(patient.mrn);
		const confirm = card.getByRole('button', { name: 'Register patient' });
		await expect(confirm).toBeDisabled();

		await card.getByLabel('Consent').check();
		await confirm.click();
		await expect(page.getByText(`I registered ${patient.givenName} ${patient.familyName}`)).toBeVisible();
		await expect(card).toContainText('Registered');

		await page.goto('/patients');
		await page.getByLabel('Search patients').fill(patient.mrn);
		await expect(page.getByTestId('patient-list').getByText(patient.familyName)).toBeVisible();
	});
});
