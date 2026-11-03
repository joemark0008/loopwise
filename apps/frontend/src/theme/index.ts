import { createTheme, Modal } from '@mantine/core';
import type { CSSVariablesResolver, MantineColorsTuple } from '@mantine/core';

/** Loopwise care blue, built around #1f5fae (index 7) and #6fa8f0 (index 4, the dark-mode primary). */
const brand: MantineColorsTuple = [
	'#e8f0fa',
	'#cfe0f6',
	'#b0cff7',
	'#8cb8f0',
	'#6fa8f0',
	'#3b7bd0',
	'#2a6cbf',
	'#1f5fae',
	'#174a8a',
	'#10345f',
];

/** Stock components read dark-* directly, so it is rebuilt on the navy dark tokens (tokens.css). */
const dark: MantineColorsTuple = [
	'#f4f7fb',
	'#dce3ec',
	'#a3b0c2',
	'#6b7c97',
	'#34445f',
	'#25324a',
	'#1a2740',
	'#111c2e',
	'#0e1828',
	'#0b1424',
];

export const theme = createTheme({
	primaryColor: 'brand',
	primaryShade: { light: 7, dark: 4 },
	defaultRadius: 'md',
	colors: { brand, dark },
	fontFamily: 'var(--app-font-body)',
	fontFamilyMonospace: 'var(--app-font-mono)',
	headings: { fontFamily: 'var(--app-font-heading)', fontWeight: '600' },
	fontSizes: { xs: '0.75rem', sm: '0.875rem', md: '1rem', lg: '1.125rem', xl: '1.25rem' },
	lineHeights: { xs: '1.4', sm: '1.45', md: '1.5', lg: '1.5', xl: '1.5' },
	components: {
		Modal: Modal.extend({
			defaultProps: {
				radius: 'lg',
				transitionProps: { transition: 'pop', duration: 180, timingFunction: 'cubic-bezier(.2,.8,.2,1)' },
			},
		}),
	},
});

const tokenVariables = {
	'--mantine-color-body': 'var(--app-surface)',
	'--mantine-color-text': 'var(--app-body)',
	'--mantine-color-dimmed': 'var(--app-muted)',
	'--mantine-color-default': 'var(--app-surface)',
	'--mantine-color-default-hover': 'var(--app-fill)',
	'--mantine-color-default-color': 'var(--app-body)',
	'--mantine-color-default-border': 'var(--app-line)',
	'--mantine-color-anchor': 'var(--app-accent-text)',
	'--mantine-color-error': 'var(--app-danger)',
};

export const cssVariablesResolver: CSSVariablesResolver = () => ({
	variables: {},
	light: tokenVariables,
	dark: tokenVariables,
});
