import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { logIn } from './helpers';
import type { Page } from '@playwright/test';

/**
 * WCAG 2.2 AA checks (axe) on the clinical screens, in light and dark (docs/design-system.md). Fails on serious and
 * critical violations only; the rest are reported in the test output.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function check(page: Page, name: string) {
	const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
	const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
	const summary = blocking.map(
		(v) => `${name}: ${v.id} (${v.impact}) ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
	);
	expect(summary, summary.join('\n')).toEqual([]);
}

async function patientIds(page: Page) {
	return page.evaluate(async () => {
		const graphql = async (query: string, variables: Record<string, unknown>) =>
			(
				await (
					await fetch('/graphql', {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ query, variables }),
					})
				).json()
			).data;
		const { searchPatients } = await graphql(
			'query($input: SearchPatientsInput!) { searchPatients(input: $input) { id } }',
			{ input: { query: 'Maria Santos' } },
		);
		const patientId = searchPatients[0].id as string;
		const { encounters } = await graphql('query($id: ID!) { encounters(patientId: $id) { id } }', {
			id: patientId,
		});
		return { patientId, encounterId: encounters[encounters.length - 1].id as string };
	});
}

for (const colorScheme of ['light', 'dark'] as const) {
	test.describe(`accessibility (${colorScheme})`, () => {
		test.use({ colorScheme });

		test('the login page', async ({ page }) => {
			await page.goto('/login');
			await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
			await check(page, 'login');
		});

		test('the clinical screens', async ({ page }) => {
			test.setTimeout(180_000);
			await logIn(page);
			const { patientId, encounterId } = await patientIds(page);
			const record = `/patients/${patientId}/encounters/${encounterId}`;
			for (const [name, path] of [
				['today', '/'],
				['patients', '/patients'],
				['register', '/patients/new'],
				['chart', `/patients/${patientId}`],
				['results inbox', '/results'],
				['wise chats', '/chats'],
				['appointments', '/appointments'],
				['appointments week', '/appointments?view=week'],
				['queue', '/queue'],
				['triage', '/triage'],
				['my queue', '/my-queue'],
				['board', '/board'],
				...['note', 'vitals', 'orders', 'prescriptions', 'certificate', 'billing'].map(
					(tab) => [`record ${tab}`, `${record}?tab=${tab}`] as const,
				),
			] as const) {
				await page.goto(path);
				await expect(page.locator('main h1').first()).toBeVisible();
				await check(page, name);
			}
		});
	});
}
