import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

/** The `--app-*` hex values of one block of tokens.css, with `var(--app-x)` aliases resolved. */
function readBlock(selector: string): Record<string, string> {
	const start = tokens.indexOf(`${selector} {`);
	const body = tokens.slice(start, tokens.indexOf('\n}', start));
	const values: Record<string, string> = {};
	for (const [, name, value] of body.matchAll(/--app-([\w-]+):\s*([^;]+);/g)) {
		values[name] = value.trim();
	}
	return values;
}

const light = readBlock(':root');
const dark = { ...light, ...readBlock(":root[data-mantine-color-scheme='dark']") };

function hex(scheme: Record<string, string>, name: string): string {
	let value = scheme[name];
	for (let alias = value?.match(/^var\(--app-([\w-]+)\)$/); alias; alias = value?.match(/^var\(--app-([\w-]+)\)$/)) {
		value = scheme[alias[1]];
	}
	if (!value || !/^#[0-9a-f]{6}$/i.test(value)) {
		throw new Error(`--app-${name} is not a 6-digit hex colour: ${value}`);
	}
	return value;
}

function luminance(color: string): number {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const channel = parseInt(color.slice(i, i + 2), 16) / 255;
		return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
	const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (high + 0.05) / (low + 0.05);
}

/** Text on the surfaces it sits on: WCAG AA, 4.5:1 (docs/design-system.md). */
const TEXT_PAIRS: [string, string][] = [
	['text', 'surface'],
	['text', 'bg'],
	['body', 'surface'],
	['muted', 'surface'],
	['muted', 'bg'],
	['muted', 'fill'],
	['accent-text', 'surface'],
	['primary-fg', 'primary-bg'],
	['wise', 'surface'],
	['wise', 'wise-bg'],
	['critical', 'critical-bg'],
	['critical', 'surface'],
	['abnormal', 'abnormal-bg'],
	['abnormal', 'surface'],
	['info', 'info-bg'],
	['done', 'done-bg'],
	['nav-text', 'nav-bg'],
	['nav-muted', 'nav-bg'],
];

/** Control boundaries: WCAG non-text contrast, 3:1. */
const UI_PAIRS: [string, string][] = [['control-line', 'surface']];

describe('design tokens contrast', () => {
	for (const [schemeName, scheme] of [
		['light', light],
		['dark', dark],
	] as const) {
		it.each(TEXT_PAIRS)(`${schemeName}: --app-%s on --app-%s is at least 4.5:1`, (fg, bg) => {
			expect(contrast(hex(scheme, fg), hex(scheme, bg))).toBeGreaterThanOrEqual(4.5);
		});
		it.each(UI_PAIRS)(`${schemeName}: --app-%s on --app-%s is at least 3:1`, (fg, bg) => {
			expect(contrast(hex(scheme, fg), hex(scheme, bg))).toBeGreaterThanOrEqual(3);
		});
	}
});
