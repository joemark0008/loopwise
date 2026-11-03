import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { test } from '@playwright/test';

import { logIn } from './helpers';
import type { Page } from '@playwright/test';

/**
 * Screenshots of the clinical screens at phone, tablet and desktop widths, light and dark, for the UX redesign's
 * before/after comparison. Not a test: it only runs with E2E_UX_DIR set.
 */
const OUT = process.env.E2E_UX_DIR;
test.skip(!OUT, 'Set E2E_UX_DIR to record the UX screenshots.');

const WIDTHS = [
	{ name: 'phone', width: 390, height: 844 },
	{ name: 'tablet', width: 820, height: 1180 },
	{ name: 'desktop', width: 1440, height: 900 },
] as const;

async function graphql<T>(page: Page, query: string, variables: Record<string, unknown> = {}): Promise<T> {
	return page.evaluate(
		async (request) => {
			const response = await fetch('/graphql', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(request),
			});
			return (await response.json()).data;
		},
		{ query, variables },
	);
}

/** Maria Santos's chart and first encounter, plus Jose Ramos (allergy) and a prescription to print. */
async function seedRoutes(page: Page) {
	const find = async (name: string) => {
		const data = await graphql<{ searchPatients: { id: string }[] }>(
			page,
			'query($input: SearchPatientsInput!) { searchPatients(input: $input) { id } }',
			{ input: { query: name } },
		);
		return data.searchPatients[0].id;
	};
	const firstEncounter = async (patientId: string) => {
		const data = await graphql<{ encounters: { id: string }[] }>(
			page,
			'query($id: ID!) { encounters(patientId: $id) { id } }',
			{ id: patientId },
		);
		return data.encounters[data.encounters.length - 1].id;
	};
	const maria = await find('Maria Santos');
	const jose = await find('Jose Ramos');
	const mariaEncounter = await firstEncounter(maria);
	const joseEncounter = await firstEncounter(jose);
	const record = `/patients/${maria}/encounters/${mariaEncounter}`;
	return {
		home: '/',
		patients: '/patients',
		register: '/patients/new',
		chart: `/patients/${maria}`,
		'record-note': `${record}?tab=note`,
		'record-vitals': `${record}?tab=vitals`,
		'record-orders': `${record}?tab=orders`,
		'record-billing': `${record}?tab=billing`,
		'allergy-rx': `/patients/${jose}/encounters/${joseEncounter}?tab=prescriptions`,
		settings: '/settings/account',
	};
}

test('record the UX screens', async ({ browser }) => {
	test.setTimeout(900_000);
	mkdirSync(OUT!, { recursive: true });
	for (const scheme of ['light', 'dark'] as const) {
		for (const size of WIDTHS) {
			const context = await browser.newContext({
				colorScheme: scheme,
				viewport: { width: size.width, height: size.height },
			});
			const page = await context.newPage();
			await page.goto('/login');
			await page.waitForTimeout(1000);
			await page.screenshot({ path: join(OUT!, `login-${size.name}-${scheme}.png`), fullPage: true });
			await logIn(page);
			const routes = await seedRoutes(page);
			for (const [name, route] of Object.entries(routes)) {
				await page.goto(route);
				await page.waitForTimeout(2000);
				await page.screenshot({ path: join(OUT!, `${name}-${size.name}-${scheme}.png`), fullPage: true });
			}
			await context.close();
		}
	}
});
