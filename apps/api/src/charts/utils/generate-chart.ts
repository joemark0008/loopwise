import { createRequire } from 'node:module';

import { CHART_EMBEDDED_FONT_FAMILY, CHART_FONT_STACK } from '@loopwise/shared';

import { chartFontFiles } from './chart-fonts.js';

/**
 * loopwise: upstream loads Recharts' markup into cheerio (xml mode) to pick out the `<svg>` and edit its root;
 * cheerio isn't a dependency here, so the root `<svg>` element is cut out of React's server markup by hand.
 * React escapes `<`, `>`, `&` and quotes in text and attribute values, so tags can be scanned directly.
 */
function extractSvgFromHTML(html: string): string {
	const start = html.indexOf('<svg');
	if (start === -1) {
		throw new Error('Recharts did not render SVG content');
	}
	const tagPattern = /<(\/?)svg\b[^>]*?(\/?)>/g;
	tagPattern.lastIndex = start;
	let depth = 0;
	for (let match = tagPattern.exec(html); match; match = tagPattern.exec(html)) {
		const [tag, closing, selfClosing] = match;
		if (closing) {
			depth -= 1;
		} else if (!selfClosing) {
			depth += 1;
		}
		if (depth === 0) {
			return html.slice(start, match.index + tag.length);
		}
	}
	throw new Error('Recharts did not render SVG content');
}

/** Sets attributes on the root `<svg>`, then prepends and appends markup inside it (cheerio's `attr`/`prepend`/`append`). */
function editSvgRoot(
	svg: string,
	attributes: Record<string, string>,
	content: { prepend?: string; append?: string },
): string {
	const openEnd = svg.indexOf('>');
	const openTag = svg.slice(0, openEnd + 1);
	const selfClosing = openTag.endsWith('/>');
	const existing = [...openTag.matchAll(/\s([^\s=/>]+)="([^"]*)"/g)].map(([, name, value]) => [name, value]);
	const merged = new Map<string, string>(existing as [string, string][]);
	for (const [name, value] of Object.entries(attributes)) {
		merged.set(name, escapeXml(value));
	}
	const attrs = [...merged.entries()].map(([name, value]) => ` ${name}="${value}"`).join('');
	const inner = selfClosing ? '' : svg.slice(openEnd + 1, svg.lastIndexOf('</svg>'));
	return `<svg${attrs}>${content.prepend ?? ''}${inner}${content.append ?? ''}</svg>`;
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/** A `<text>` element with the given attributes and escaped content. */
function textElement(attributes: Record<string, string>, text: string): string {
	const attrs = Object.entries(attributes)
		.map(([name, value]) => ` ${name}="${escapeXml(value)}"`)
		.join('');
	return `<text${attrs}>${escapeXml(text)}</text>`;
}

export interface LegendEntry {
	label: string;
	color: string;
}

export type LegendLayout = 'horizontal' | 'vertical';

/** Width reserved on the right for a vertical (pie/donut) legend. */
export const VERTICAL_LEGEND_WIDTH = 200;

const SVG_BACKGROUND = 'var(--background, white)';
const SVG_LEGEND_TEXT = 'var(--muted-foreground, #6b7280)';

export function createSvg(
	html: string,
	width: number,
	height: number,
	legend: LegendEntry[],
	legendLayout: LegendLayout = 'horizontal',
): string {
	if (legendLayout === 'vertical') {
		return createSvgWithRightLegend(html, width, height, legend);
	}

	const legendHeight = legend.length > 0 ? 24 : 0;
	const totalHeight = height + legendHeight;

	return editSvgRoot(
		extractSvgFromHTML(html),
		{
			xmlns: 'http://www.w3.org/2000/svg',
			width: String(width),
			height: String(totalHeight),
			viewBox: `0 0 ${width} ${totalHeight}`,
		},
		{
			prepend: `<rect width="${width}" height="${totalHeight}" fill="${SVG_BACKGROUND}"/>`,
			append: legend.length > 0 ? buildLegend(legend, width, height + legendHeight / 2) : '',
		},
	);
}

function createSvgWithRightLegend(html: string, width: number, height: number, legend: LegendEntry[]): string {
	const totalWidth = width + VERTICAL_LEGEND_WIDTH;

	return editSvgRoot(
		extractSvgFromHTML(html),
		{
			xmlns: 'http://www.w3.org/2000/svg',
			width: String(totalWidth),
			height: String(height),
			viewBox: `0 0 ${totalWidth} ${height}`,
		},
		{
			prepend: `<rect width="${totalWidth}" height="${height}" fill="${SVG_BACKGROUND}"/>`,
			append: legend.length > 0 ? buildVerticalLegend(legend, width + 12, totalWidth, height) : '',
		},
	);
}

function buildLegend(entries: LegendEntry[], width: number, centerY: number): string {
	const swatchSize = 10;
	const gap = 6;
	const itemSpacing = 16;
	const charWidth = 7;

	const totalWidth = entries.reduce(
		(sum, e, i) => sum + swatchSize + gap + e.label.length * charWidth + (i < entries.length - 1 ? itemSpacing : 0),
		0,
	);
	let x = (width - totalWidth) / 2;

	const items = entries.map((entry) => {
		const swatch = `<rect x="${x}" y="${centerY - swatchSize / 2}" width="${swatchSize}" height="${swatchSize}" rx="2" fill="${entry.color}"/>`;
		const label = textElement(
			{
				x: String(x + swatchSize + gap),
				y: String(centerY),
				'dominant-baseline': 'middle',
				'font-size': '12',
				'font-weight': '300',
				'font-family': CHART_FONT_STACK,
				fill: SVG_LEGEND_TEXT,
			},
			entry.label,
		);
		x += swatchSize + gap + entry.label.length * charWidth + itemSpacing;
		return swatch + label;
	});

	return `<g>${items.join('')}</g>`;
}

function buildVerticalLegend(entries: LegendEntry[], xOffset: number, rightEdge: number, height: number): string {
	const swatchSize = 10;
	const gap = 6;
	const lineHeight = 22;
	const charWidth = 7;
	const rightPadding = 12;

	const textX = xOffset + swatchSize + gap;
	const maxChars = Math.max(1, Math.floor((rightEdge - textX - rightPadding) / charWidth));

	const totalHeight = entries.length * lineHeight;
	let y = (height - totalHeight) / 2 + lineHeight / 2;

	const items = entries.map((entry) => {
		const swatch = `<rect x="${xOffset}" y="${y - swatchSize / 2}" width="${swatchSize}" height="${swatchSize}" rx="2" fill="${entry.color}"/>`;
		const label = textElement(
			{
				x: String(textX),
				y: String(y),
				'dominant-baseline': 'middle',
				'font-size': '12',
				'font-weight': '300',
				'font-family': CHART_FONT_STACK,
				fill: SVG_LEGEND_TEXT,
			},
			truncateLabel(entry.label, maxChars),
		);
		y += lineHeight;
		return swatch + label;
	});

	return `<g>${items.join('')}</g>`;
}

/**
 * Truncates a legend label with an ellipsis so it never overflows the column.
 * Works on code points (not UTF-16 units) so it never splits a surrogate pair
 * (emoji, CJK extensions) into a lone surrogate that would be invalid in SVG.
 */
export function truncateLabel(label: string, maxChars: number): string {
	const codePoints = Array.from(label);
	if (codePoints.length <= maxChars) {
		return label;
	}
	if (maxChars <= 1) {
		return '…';
	}
	return `${codePoints.slice(0, maxChars - 1).join('')}…`;
}

/**
 * resvg is loaded on first use: it picks its native binary by `process.platform` when imported, and the agent's tool
 * graph reaches this file through the story renderer (specs fake the platform).
 */
let resvgModule: typeof import('@resvg/resvg-js') | undefined;
function loadResvg(): typeof import('@resvg/resvg-js') {
	resvgModule ??= createRequire(import.meta.url)('@resvg/resvg-js') as typeof import('@resvg/resvg-js');
	return resvgModule;
}

export function svgToPng(svg: string, zoom = 2, cssVariables: Record<string, string> = {}): Buffer {
	const { Resvg } = loadResvg();
	const resvg = new Resvg(resolveCssVariables(svg, cssVariables), {
		fitTo: { mode: 'zoom' as const, value: zoom },
		font: {
			fontFiles: chartFontFiles,
			defaultFontFamily: CHART_EMBEDDED_FONT_FAMILY,
			sansSerifFamily: CHART_EMBEDDED_FONT_FAMILY,
			loadSystemFonts: true,
		},
	});
	return Buffer.from(resvg.render().asPng());
}

const PAINT_ATTRIBUTES = ['fill', 'stroke', 'stop-color', 'color', 'style'];
const PAINT_ATTRIBUTE_PATTERN = new RegExp(`(${PAINT_ATTRIBUTES.join('|')})="([^"]*)"`, 'g');

/**
 * resvg resolves no CSS custom property, so `var(--x, #111)` reaches the
 * renderer verbatim and silently degrades to the SVG default fill. Only the
 * PNG path needs this: the same markup keeps its variables when embedded in
 * story HTML, where the browser resolves them against the active theme.
 * A variable takes its value from `cssVariables` when the story is themed,
 * else its fallback.
 *
 * Scoped to paint attributes because chart titles and labels are user data: a
 * title reading "var(--foo, 12px)" must reach the PNG unchanged.
 */
export function resolveCssVariables(svg: string, cssVariables: Record<string, string> = {}): string {
	return svg.replace(PAINT_ATTRIBUTE_PATTERN, (match, attribute, value) => {
		const resolved = resolveVarFunctions(value, cssVariables);
		return resolved === value ? match : `${attribute}="${resolved}"`;
	});
}

/**
 * Hand-scanned rather than matched by regex: a fallback can itself be a
 * function, as in `var(--c, rgb(0,0,0))`, which no single pattern can bracket.
 */
function resolveVarFunctions(value: string, cssVariables: Record<string, string>): string {
	const start = value.indexOf('var(');
	if (start === -1) {
		return value;
	}

	const open = start + 'var('.length;
	const close = findClosingParenthesis(value, open);
	if (close === -1) {
		return value;
	}

	const argumentList = value.slice(open, close);
	const themed = cssVariables[variableName(argumentList)];
	const fallback = splitFallback(argumentList);
	const replacement =
		themed ??
		(fallback === undefined ? value.slice(start, close + 1) : resolveVarFunctions(fallback, cssVariables));
	return value.slice(0, start) + replacement + resolveVarFunctions(value.slice(close + 1), cssVariables);
}

function variableName(argumentList: string): string {
	const comma = argumentList.indexOf(',');
	return (comma === -1 ? argumentList : argumentList.slice(0, comma)).trim();
}

function findClosingParenthesis(value: string, open: number): number {
	let depth = 1;
	for (let index = open; index < value.length; index += 1) {
		if (value[index] === '(') {
			depth += 1;
		} else if (value[index] === ')') {
			depth -= 1;
			if (depth === 0) {
				return index;
			}
		}
	}
	return -1;
}

/** Returns the fallback of `--name, fallback`, or undefined when there is none. */
function splitFallback(argumentList: string): string | undefined {
	let depth = 0;
	for (let index = 0; index < argumentList.length; index += 1) {
		const character = argumentList[index];
		if (character === '(') {
			depth += 1;
		} else if (character === ')') {
			depth -= 1;
		} else if (character === ',' && depth === 0) {
			return argumentList.slice(index + 1).trim();
		}
	}
	return undefined;
}
