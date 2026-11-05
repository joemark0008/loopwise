/**
 * The avatar's background, picked from the user's name, behind white initials. The avatar sets both colours itself, so
 * they are the same in light and dark mode; each pair meets WCAG AA for normal text (4.5:1, `avatar-colors.test.ts`).
 * The hues are Tailwind's 700 shades, in the order of the 500 shades they replace (a name keeps its hue).
 */
export const AVATAR_TEXT_COLOR = '#ffffff';

export const AVATAR_COLORS = [
	'#b91c1c', // red
	'#c2410c', // orange
	'#b45309', // amber
	'#a16207', // yellow
	'#4d7c0f', // lime
	'#15803d', // green
	'#047857', // emerald
	'#0f766e', // teal
	'#0e7490', // cyan
	'#0369a1', // sky
	'#1d4ed8', // blue
	'#4338ca', // indigo
	'#6d28d9', // violet
	'#7e22ce', // purple
	'#a21caf', // fuchsia
	'#be185d', // pink
	'#be123c', // rose
] as const;

/** WCAG 2 relative luminance of a `#rrggbb` colour. */
export function relativeLuminance(hex: string): number {
	const [r, g, b] = [1, 3, 5].map((index) => {
		const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
		return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio of two `#rrggbb` colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
	const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
	return (lighter + 0.05) / (darker + 0.05);
}
