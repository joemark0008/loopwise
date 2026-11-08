import { useSyncExternalStore } from 'react';

/** Whether a media query matches, kept in sync with the window. `fallback` is used where matchMedia is missing. */
export function useMediaQuery(query: string, fallback = false): boolean {
	return useSyncExternalStore(
		(onChange) => {
			if (typeof window.matchMedia !== 'function') {
				return () => undefined;
			}
			const mql = window.matchMedia(query);
			mql.addEventListener('change', onChange);
			return () => mql.removeEventListener('change', onChange);
		},
		() => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : fallback),
		() => fallback,
	);
}
