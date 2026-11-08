/** Dark mode is the `dark` class on the root (Tailwind's and shadcn's convention); tokens follow it. */
const DARK_CLASS = 'dark';

export function isDarkColorScheme(root: HTMLElement = document.documentElement): boolean {
	return root.classList.contains(DARK_CLASS);
}

/** Tokens follow this class, so setting it repaints every surface under `root`. */
export function setColorSchemeAttribute(dark: boolean, root: HTMLElement = document.documentElement) {
	root.classList.toggle(DARK_CLASS, dark);
	root.style.colorScheme = dark ? 'dark' : 'light';
}
