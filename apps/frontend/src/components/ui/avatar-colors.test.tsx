// @vitest-environment jsdom

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar } from './avatar';
import { AVATAR_COLORS, AVATAR_TEXT_COLOR, contrastRatio } from './avatar-colors';

describe('avatar colours', () => {
	it('computes the WCAG contrast ratio', () => {
		expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21);
		expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
	});

	it.each(AVATAR_COLORS)('%s meets WCAG AA (4.5:1) behind the white initials', (color) => {
		expect(contrastRatio(color, AVATAR_TEXT_COLOR)).toBeGreaterThanOrEqual(4.5);
	});

	// Light and dark mode render the same pair: the avatar sets both colours inline, no theme token in between.
	it('sets its background and text colour itself, so the theme cannot change the pair', () => {
		for (const name of ['Test Admin', 'Test', 'Maria Santos', 'Ramon Reyes', 'Liza Cruz']) {
			const { getByTitle, unmount } = render(<Avatar username={name} />);
			const avatar = getByTitle(name);
			expect(AVATAR_COLORS.map((color) => hexToRgb(color))).toContain(avatar.style.backgroundColor);
			expect(avatar.style.color).toBe(hexToRgb(AVATAR_TEXT_COLOR));
			unmount();
		}
	});
});

const hexToRgb = (hex: string) =>
	`rgb(${[1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16)).join(', ')})`;
