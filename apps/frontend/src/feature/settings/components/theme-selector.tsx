import { Sun, Moon, Monitor } from 'lucide-react';
import styles from './theme-selector.module.css';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/theme.provider';
import { cn } from '@/lib/utils';

const themeOptions = [
	{ value: 'light', label: 'Light', icon: Sun },
	{ value: 'dark', label: 'Dark', icon: Moon },
	{ value: 'system', label: 'System', icon: Monitor },
] as const;

export const ThemeSelector = () => {
	const { theme, setTheme } = useTheme();

	return (
		<div className={styles.themeSelectorDiv}>
			{themeOptions.map((option) => {
				const Icon = option.icon;
				const isSelected = theme === option.value;

				return (
					<Button
						key={option.value}
						onClick={() => {
							setTheme(option.value);
						}}
						variant={isSelected ? 'ghost' : 'ghost-muted'}
						size='sm'
						className={cn(
							styles.themeSelectorButton,
							isSelected ? styles.themeSelectorButton2 : styles.themeSelectorButton3,
						)}
					>
						<Icon className={styles.themeSelectorIcon} />
						{option.label}
					</Button>
				);
			})}
		</div>
	);
};
