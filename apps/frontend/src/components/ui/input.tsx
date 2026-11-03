import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';

import styles from './input.module.css';
import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
	const [showPassword, setShowPassword] = React.useState(false);
	const isPassword = type === 'password';
	const inputType = isPassword && showPassword ? 'text' : type;

	if (isPassword) {
		return (
			<div className={styles.inputDiv}>
				<input
					type={inputType}
					data-slot='input'
					className={cn(
						styles.inputInput,
						styles.inputInput2,
						styles.inputInput3,
						styles.inputInput4,
						className,
					)}
					{...props}
				/>
				<button
					type='button'
					onClick={() => setShowPassword(!showPassword)}
					className={styles.inputButton}
					tabIndex={-1}
				>
					{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
				</button>
			</div>
		);
	}

	return (
		<input
			type={type}
			data-slot='input'
			className={cn(styles.inputInput, styles.inputInput2, styles.inputInput3, className)}
			{...props}
		/>
	);
}

function NakedInput({ className, ...props }: React.ComponentProps<'input'>) {
	return <input className={cn(styles.nakedInputInput, className)} {...props} />;
}

export { Input, NakedInput };
