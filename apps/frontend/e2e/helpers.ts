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
