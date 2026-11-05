import { expect, test } from '@playwright/test';
import { logIn, trackErrors } from './helpers';

/** Maria Santos, the seed's first patient at clinic TAG (patient numbers restart each year, Asia/Manila). */
const MARIA_PATIENT_NO = `TAG-PT-${new Date(Date.now() + 8 * 3_600_000).getUTCFullYear()}-000001`;

/** A synthetic patient no earlier run registered (the development database keeps them). */
const uniquePatient = () => {
	const run = Date.now().toString(36).toUpperCase();
	return { givenName: 'Rosa', familyName: `Testcase${run.toLowerCase()}`, mrn: `TAG-E2E-${run}` };
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
		await page.getByLabel('Existing chart no.').fill(patient.mrn);
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
		await page.getByLabel('Existing chart no.').fill(MARIA_PATIENT_NO);
		await page.getByLabel('Consent').check();
		await page.getByRole('button', { name: 'Register patient' }).click();
		await expect(page.getByTestId('duplicate-alert')).toContainText('This patient is already registered');
		await expect(page.getByTestId('duplicate-alert')).toContainText(`Same patient no. ${MARIA_PATIENT_NO}`);
	});

	test('the form registers at the active clinic when the organization has several', async ({ page }) => {
		// A second clinic of the organization (synthetic), removed again at the end.
		const graphql = async (query: string, variables: object, clinicId?: string) => {
			const response = await page.request.post('/graphql', {
				data: { query, variables },
				headers: clinicId ? { 'x-loopwise-clinic-id': clinicId } : {},
			});
			const body = await response.json();
			expect(body.errors).toBeUndefined();
			return body.data;
		};
		const created = await graphql('mutation ($input: CreateClinicInput!) { createClinic(input: $input) { id } }', {
			input: { name: `E2E Panglao annex ${Date.now().toString(36)}` },
		});
		const secondClinicId: string = created.createClinic.id;
		try {
			await page.goto('/patients/new');
			await expect(page.getByRole('combobox', { name: 'Clinic' })).toHaveText('Tagbilaran City Health Center');
		} finally {
			await graphql(
				'mutation ($clinicId: ID!) { deleteClinic(clinicId: $clinicId) }',
				{ clinicId: secondClinicId },
				secondClinicId,
			);
		}
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
