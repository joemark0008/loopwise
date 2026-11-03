import React, { useEffect, useRef } from 'react';
import styles from './input-edit.module.css';
import { cn } from '@/lib/utils';

interface Props extends React.ComponentProps<'input'> {
	value: string;
	onSubmit: () => void;
	onEscape: () => void;
	className?: string;
	autoFocus?: boolean;
}

/** Input that takes width and style of parent element */
export const InputEdit = ({ value, onChange, onSubmit, onEscape, className, autoFocus = true, ...rest }: Props) => {
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (inputRef.current && autoFocus) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [autoFocus]);

	return (
		<div data-value={value} className={cn(styles.inputEditDiv)}>
			<input
				ref={inputRef}
				value={value}
				onChange={onChange}
				onKeyDown={(e) => {
					if (e.key === 'Enter') {
						onSubmit();
					} else if (e.key === 'Escape') {
						onEscape();
					}
				}}
				onBlur={onSubmit}
				className={cn(styles.inputEditInput, className)}
				{...rest}
			/>
		</div>
	);
};
