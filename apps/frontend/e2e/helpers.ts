import type { Page } from '@playwright/test';

export const USER = { email: 'test@test.test', password: 'test1234' };

/** The seeded doctor at the health center, who ordered the seed's results awaiting review. */
export const DOCTOR = { email: 'dr.reyes@loopwise.test', password: 'test1234' };

/** The seeded lab technician at Bohol Diagnostics. */
export const LAB_TECH = { email: 'lab.bautista@loopwise.test', password: 'test1234' };

export async function logIn(page: Page, redirect = '/', user = USER) {
	await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`);
	await page.locator('input[name="email"]').fill(user.email);
	await page.locator('input[name="password"]').fill(user.password);
	await page.getByRole('button', { name: 'Log in', exact: true }).click();
	await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

/** Uncaught exceptions and console errors, minus network noise that a healthy page can produce. */
export function trackErrors(page: Page) {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
	page.on('console', (message) => {
		if (message.type() !== 'error') {
			return;
		}
		const text = message.text();
		if (/Failed to load resource|net::ERR|Download the React DevTools/.test(text)) {
			return;
		}
		errors.push(`console: ${text.slice(0, 300)}`);
	});
	return errors;
}

/** The accessible controls on screen: what a user can see and operate, independent of styling. */
export async function controlInventory(page: Page) {
	return page.evaluate(() => {
		const visible = (el: Element) => {
			const rect = el.getBoundingClientRect();
			const style = getComputedStyle(el);
			return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.opacity !== '0';
		};
		const name = (el: Element) =>
			(
				el.getAttribute('aria-label') ||
				(el as HTMLInputElement).placeholder ||
				(el as HTMLInputElement).name ||
				el.textContent ||
				''
			)
				.replace(/\s+/g, ' ')
				.trim()
				.slice(0, 80);
		const collect = (selector: string) =>
			[...new Set([...document.querySelectorAll(selector)].filter(visible).map(name).filter(Boolean))].sort();
		return {
			headings: collect('h1,h2,h3'),
			buttons: collect('button,[role=button],[role=switch],[role=tab],[role=combobox]'),
			links: collect('a[href]'),
			inputs: collect('input,textarea,select,[contenteditable=true]'),
		};
	});
}

/** Makes a clinic with a warehouse connection the active one, and returns false if the user has none. */
export async function selectClinicWithWarehouse(page: Page): Promise<boolean> {
	const clinicId = await page.evaluate(async () => {
		const graphql = async (query: string, scope?: string) => {
			const response = await fetch('/graphql', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					...(scope && { 'x-loopwise-clinic-id': scope }),
				},
				body: JSON.stringify({ query }),
			});
			return (await response.json()).data;
		};
		const { clinics } = await graphql('{ clinics { id } }');
		for (const { id } of clinics as { id: string }[]) {
			const data = await graphql('{ warehouseConnections { name } }', id);
			if (data?.warehouseConnections?.length) {
				return id;
			}
		}
		return null;
	});
	if (!clinicId) {
		return false;
	}
	// Before each page load: the app could otherwise pick its own clinic first.
	await page.addInitScript(
		(activeId) => localStorage.setItem('loopwise.active-clinic-id', JSON.stringify(activeId)),
		clinicId,
	);
	return true;
}
