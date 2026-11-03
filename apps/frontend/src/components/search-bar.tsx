import { Search, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import styles from './search-bar.module.css';
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import { Kbd } from '@/components/ui/kbd';
import { isTypingTarget } from '@/lib/keyboard-shortcuts';
import { cn } from '@/lib/utils';

export function SearchBar({
	value,
	onChange,
	placeholder,
	ariaLabel,
	className,
	size = 'default',
	focusShortcutKey,
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	ariaLabel: string;
	className?: string;
	size?: 'default' | 'lg';
	focusShortcutKey?: string;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	useFocusShortcut(inputRef, focusShortcutKey);

	function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
		if (event.key === 'Escape') {
			if (value) {
				onChange('');
			} else {
				inputRef.current?.blur();
			}
		}
	}

	return (
		<div
			className={cn(
				`${styles.searchBarDiv} group/search`,
				size === 'lg' ? styles.searchBarDiv2 : styles.searchBarDiv3,
				className,
			)}
		>
			<Search className={styles.searchBarSearch} />
			<input
				ref={inputRef}
				type='text'
				value={value}
				onChange={(event) => onChange(event.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				aria-label={ariaLabel}
				className={styles.searchBarInput}
			/>
			{value ? (
				<button
					type='button'
					onClick={() => onChange('')}
					aria-label='Clear search'
					className={styles.searchBarButton}
				>
					<X className={styles.searchBarX} />
				</button>
			) : (
				focusShortcutKey && <Kbd keys={[focusShortcutKey]} className={styles.searchBarKbd} />
			)}
		</div>
	);
}

function useFocusShortcut(inputRef: RefObject<HTMLInputElement | null>, shortcutKey: string | undefined) {
	useEffect(() => {
		if (!shortcutKey) {
			return;
		}
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key !== shortcutKey || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event)) {
				return;
			}
			event.preventDefault();
			inputRef.current?.focus();
		}
		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [inputRef, shortcutKey]);
}
