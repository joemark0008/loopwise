import { expect, test } from '@playwright/test';
import { LAB_TECH, USER } from './helpers';
import { logInAs, openLatestVisitOrders } from './lab-flow';
import type { Page } from '@playwright/test';

async function graphql<T>(page: Page, query: string, variables: object = {}): Promise<T> {
	const response = await page.request.post('/graphql', { data: { query, variables } });
	const body = await response.json();
	expect(body.errors).toBeUndefined();
	return body.data as T;
}

/**
 * A long worklist scrolls the page; the tab bar keeps its height and stays clickable (it used to shrink to nothing in
 * the page's flex column, so the page took the clicks). Synthetic orders, cancelled again at the end.
 */
test('the worklist tabs stay clickable when the lists are long', async ({ page }) => {
	test.setTimeout(90_000);
	const marker = `E2E long list ${Date.now().toString(36)}`;
	await logInAs(page, USER, '/patients');
	const visit = await openLatestVisitOrders(page, 'Maria Santos');
	const encounterId = visit.match(/encounters\/([^/]+)/)![1];
	const { diagnosticTests } = await graphql<{ diagnosticTests: { id: string; code: string }[] }>(
		page,
		'{ diagnosticTests { id code } }',
	);
	const testId = diagnosticTests.find((candidate) => candidate.code === 'HBA1C')!.id;

	const orders: { id: string; itemId: string }[] = [];
	for (let index = 0; index < 20; index++) {
		const { createDiagnosticOrder } = await graphql<{
			createDiagnosticOrder: { id: string; items: { id: string }[] };
		}>(
			page,
			'mutation ($input: CreateDiagnosticOrderInput!) { createDiagnosticOrder(input: $input) { id items { id } } }',
			{ input: { encounterId, testIds: [testId], clinicalInfo: `${marker} #${index}` } },
		);
		orders.push({ id: createDiagnosticOrder.id, itemId: createDiagnosticOrder.items[0].id });
	}

	await logInAs(page, LAB_TECH, '/orders');
	try {
		for (const order of orders.slice(0, 10)) {
			await graphql(
				page,
				'mutation ($input: MarkSpecimenCollectedInput!) { markSpecimenCollected(input: $input) { id } }',
				{
					input: { itemId: order.itemId },
				},
			);
		}
		await page.reload();
		await expect(page.getByTestId('lab-order-row').filter({ hasText: marker })).toHaveCount(10);

		const tabs = await page.getByRole('tablist').boundingBox();
		expect(tabs?.height).toBeGreaterThanOrEqual(32);
		const collected = page.getByRole('tab', { name: /Collected/ });
		await collected.click();
		await expect(collected).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByTestId('lab-order-row').filter({ hasText: marker })).toHaveCount(10);
		await page.getByRole('tab', { name: /To collect/ }).click();
		await expect(page.getByRole('tab', { name: /To collect/ })).toHaveAttribute('aria-selected', 'true');
	} finally {
		for (const order of orders) {
			await graphql(
				page,
				'mutation ($input: CancelDiagnosticOrderInput!) { cancelDiagnosticOrder(input: $input) { id } }',
				{
					input: { orderId: order.id, reason: 'E2E cleanup' },
				},
			);
		}
	}
});
