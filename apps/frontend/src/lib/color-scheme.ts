const COLOR_SCHEME_ATTRIBUTE = 'data-mantine-color-scheme';

export function isDarkColorScheme(root: HTMLElement = document.documentElement): boolean {
	return root.getAttribute(COLOR_SCHEME_ATTRIBUTE) === 'dark';
}

/** Tokens follow this attribute, so setting it repaints every surface under `root`. */
export function setColorSchemeAttribute(dark: boolean, root: HTMLElement = document.documentElement) {
	root.setAttribute(COLOR_SCHEME_ATTRIBUTE, dark ? 'dark' : 'light');
}
