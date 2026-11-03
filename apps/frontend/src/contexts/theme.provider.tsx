import { createContext, useContext, useState, useEffect } from 'react';
import { setColorSchemeAttribute } from '@/lib/color-scheme';
import { useMemoObject } from '@/hooks/useMemoObject';

type Theme = 'light' | 'dark' | 'system';

const ThemeContext = createContext<{
	theme: Theme;
	setTheme: (theme: Theme) => void;
} | null>(null);

export const useTheme = () => {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error('useTheme must be used within a ThemeProvider');
	}
	return context;
};

const prefersDark = () =>
	typeof window !== 'undefined' &&
	typeof window.matchMedia === 'function' &&
	window.matchMedia('(prefers-color-scheme: dark)').matches;

/** Resolves the effective dark state, staying in sync with the OS when theme is 'system'. */
export const useIsDarkMode = (): boolean => {
	const { theme } = useTheme();
	const [systemDark, setSystemDark] = useState(prefersDark);

	useEffect(() => {
		if (theme !== 'system' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
			return;
		}
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		setSystemDark(mediaQuery.matches);
		const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
		mediaQuery.addEventListener('change', onChange);
		return () => mediaQuery.removeEventListener('change', onChange);
	}, [theme]);

	return theme === 'dark' || (theme === 'system' && systemDark);
};

function syncThemeColor() {
	const meta = document.querySelector('meta[name="theme-color"]');
	if (meta) {
		meta.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--app-surface'));
	}
}

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
	const [theme, setTheme] = useState<Theme>(() => {
		const saved = localStorage.getItem('theme');
		return (saved as Theme) || 'system';
	});

	useEffect(() => {
		localStorage.setItem('theme', theme);
	}, [theme]);
	useEffect(() => {
		if (theme !== 'system') {
			setColorSchemeAttribute(theme === 'dark');
			syncThemeColor();
			return;
		}
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const apply = () => {
			setColorSchemeAttribute(mediaQuery.matches);
			syncThemeColor();
		};
		apply();
		mediaQuery.addEventListener('change', apply);
		return () => mediaQuery.removeEventListener('change', apply);
	}, [theme]);

	const value = useMemoObject({ theme, setTheme });

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
