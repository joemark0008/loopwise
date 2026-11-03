import { MantineProvider } from '@mantine/core';
import { createElement } from 'react';
import { vi } from 'vitest';
import type * as TestingLibrary from '@testing-library/react';
import type { ReactNode } from 'react';

/** Mantine reads these on mount; jsdom has neither. */
if (typeof window !== 'undefined') {
	window.matchMedia ??= ((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: () => undefined,
		removeListener: () => undefined,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
		dispatchEvent: () => false,
	})) as unknown as typeof window.matchMedia;
	window.ResizeObserver ??= class {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof ResizeObserver;
}

/** Every rendered tree gets the provider the app has at its root. */
vi.mock('@testing-library/react', async (importOriginal) => {
	const actual = await importOriginal<typeof TestingLibrary>();
	const wrapIn = (Inner?: React.ComponentType<{ children: ReactNode }>) =>
		function TestProviders({ children }: { children: ReactNode }) {
			const content = Inner ? createElement(Inner, null, children) : children;
			return createElement(
				MantineProvider,
				{ env: 'test', withCssVariables: false, withGlobalClasses: false },
				content,
			);
		};
	return {
		...actual,
		render: (ui: never, options?: Parameters<typeof actual.render>[1]) =>
			actual.render(ui, { ...options, wrapper: wrapIn(options?.wrapper as never) }),
		renderHook: (hook: never, options?: Parameters<typeof actual.renderHook>[1]) =>
			actual.renderHook(hook, { ...options, wrapper: wrapIn(options?.wrapper as never) }),
	};
});
