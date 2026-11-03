import { useCallback, useState } from 'react';

/** How the patient's Wise panel sits beside the chart: docked (resizable), taking the main area, or a rail. */
export type WiseMode = 'docked' | 'expanded' | 'collapsed';

export const WISE_MIN_WIDTH = 380;
export const WISE_DEFAULT_WIDTH = 440;
const STORAGE_KEY = 'loopwise.wise-layout';

interface WiseLayout {
	mode: WiseMode;
	width: number;
}

function read(): WiseLayout {
	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<WiseLayout> | null;
		return {
			mode: saved?.mode === 'expanded' || saved?.mode === 'collapsed' ? saved.mode : 'docked',
			width: typeof saved?.width === 'number' ? Math.max(WISE_MIN_WIDTH, saved.width) : WISE_DEFAULT_WIDTH,
		};
	} catch {
		return { mode: 'docked', width: WISE_DEFAULT_WIDTH };
	}
}

/** The Wise panel's mode and width, remembered in this browser (a per-viewer convenience, not shared state). */
export function useWiseLayout() {
	const [layout, setLayout] = useState<WiseLayout>(read);
	const update = useCallback((next: Partial<WiseLayout>) => {
		setLayout((current) => {
			const merged = { ...current, ...next };
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
			} catch {
				// Storage may be off (private mode); the layout still works for this visit.
			}
			return merged;
		});
	}, []);
	return {
		...layout,
		setMode: useCallback((mode: WiseMode) => update({ mode }), [update]),
		setWidth: useCallback((width: number) => update({ width: Math.round(width) }), [update]),
	};
}
