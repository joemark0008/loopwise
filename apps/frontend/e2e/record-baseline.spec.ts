import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { controlInventory, logIn, trackErrors } from './helpers';
import { APP_ROUTES, PUBLIC_ROUTES } from './routes';

const OUT = process.env.E2E_RECORD_DIR;
test.skip(!OUT, 'Set E2E_RECORD_DIR to record screenshots and the control inventory.');

const slug = (route: string) => route.replace(/\W+/g, '_') || 'root';

test('record every route', async ({ browser }) => {
	test.setTimeout(600_000);
	mkdirSync(OUT!, { recursive: true });
	const report: Record<string, unknown> = {};
	for (const scheme of ['light', 'dark'] as const) {
		const context = await browser.newContext({ colorScheme: scheme, viewport: { width: 1440, height: 900 } });
		const page = await context.newPage();
		const errors = trackErrors(page);
		for (const route of PUBLIC_ROUTES) {
			await page.goto(route);
			await page.waitForTimeout(1500);
			await page.screenshot({ path: join(OUT!, `${scheme}${slug(route)}.png`) });
			if (scheme === 'light') {
				report[route] = { url: new URL(page.url()).pathname, ...(await controlInventory(page)) };
			}
		}
		await logIn(page);
		for (const route of APP_ROUTES) {
			errors.length = 0;
			await page.goto(route);
			await page.waitForTimeout(2500);
			await page.screenshot({ path: join(OUT!, `${scheme}${slug(route)}.png`) });
			if (scheme === 'light') {
				report[route] = {
					url: new URL(page.url()).pathname,
					errors: [...errors],
					...(await controlInventory(page)),
				};
			}
		}
		await context.close();
	}
	writeFileSync(join(OUT!, 'inventory.json'), `${JSON.stringify(report, null, '\t')}\n`);
	expect(missingFromBaseline(report)).toEqual({});
});

type Inventory = Record<string, Record<'headings' | 'buttons' | 'inputs', string[]>>;

/** Controls recorded before the redesign that no longer appear. Links hold chat titles, so they vary with the data. */
function missingFromBaseline(report: Record<string, unknown>) {
	const baseline = JSON.parse(
		readFileSync(new URL('./baseline-inventory.json', import.meta.url), 'utf8'),
	) as Inventory;
	const current = report as Inventory;
	const missing: Record<string, string[]> = {};
	for (const [route, recorded] of Object.entries(baseline)) {
		const gone = (['headings', 'buttons', 'inputs'] as const).flatMap((kind) =>
			recorded[kind].filter((name) => !current[route]?.[kind].includes(name)),
		);
		if (gone.length > 0) {
			missing[route] = gone;
		}
	}
	return missing;
}
