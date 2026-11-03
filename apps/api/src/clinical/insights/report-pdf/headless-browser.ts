import { execSync } from 'child_process';
import { existsSync } from 'fs';
import type { Browser } from 'puppeteer-core';

import { HandlerError } from '../../../common/errors/handler-error.js';

// Ported from loopwise's `stories/utils/headless-browser.ts`: one shared, lazily launched headless Chrome, relaunched
// if it disconnects. Chrome itself is not bundled: the image installs chromium (CHROME_PATH), a laptop uses Chrome.

let browserPromise: Promise<Browser> | null = null;
let activeBrowser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
	if (browserPromise) {
		const browser = await browserPromise.catch(() => null);
		if (browser?.connected) {
			return browser;
		}
		await closeBrowser();
	}
	browserPromise ??= launchBrowser();
	return browserPromise;
}

async function launchBrowser(): Promise<Browser> {
	try {
		const puppeteer = await import('puppeteer-core');
		const browser = await puppeteer.default.launch({
			headless: true,
			executablePath: findChromePath(),
			args: launchArgs(),
		});
		activeBrowser = browser;
		browser.on('disconnected', () => {
			if (activeBrowser === browser) {
				activeBrowser = null;
			}
		});
		return browser;
	} catch (error) {
		browserPromise = null;
		throw error;
	}
}

function launchArgs(): string[] {
	const args = ['--disable-gpu', '--disable-dev-shm-usage'];
	const noSandbox =
		process.env.PUPPETEER_DISABLE_SANDBOX === '1' ||
		process.env.DOCKER === '1' ||
		(typeof process.getuid === 'function' && process.getuid() === 0);
	return noSandbox ? ['--no-sandbox', '--disable-setuid-sandbox', ...args] : args;
}

/** Whether a Chrome to print with exists on this machine (the PDF e2e tests skip without one). */
export function hasChrome(): boolean {
	try {
		findChromePath();
		return true;
	} catch {
		return false;
	}
}

function findChromePath(): string {
	const candidates = [
		process.env.CHROME_PATH,
		process.env.PUPPETEER_EXECUTABLE_PATH,
		'/usr/bin/chromium',
		'/usr/bin/chromium-browser',
		'/usr/bin/google-chrome',
		'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
	];
	for (const candidate of candidates) {
		if (candidate && existsSync(candidate)) {
			return candidate;
		}
	}
	try {
		const found = execSync('which chromium || which chromium-browser || which google-chrome', {
			encoding: 'utf-8',
			stdio: ['ignore', 'pipe', 'ignore'],
		}).trim();
		if (found) {
			return found;
		}
	} catch {
		// Falls through to the error below.
	}
	throw new HandlerError(
		'SERVICE_UNAVAILABLE',
		'PDF export needs Chrome or Chromium on the server. Install it or set CHROME_PATH.',
	);
}

export async function closeBrowser(): Promise<void> {
	const promise = browserPromise;
	browserPromise = null;
	activeBrowser = null;
	const browser = await promise?.catch(() => null);
	await browser?.close().catch(() => {});
}

process.once('exit', () => {
	activeBrowser?.process()?.kill('SIGKILL');
});
