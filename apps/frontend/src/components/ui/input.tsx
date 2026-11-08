import { Eye, EyeOff } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

/** The kit's input; the border keeps 3:1 against the surface (`border-control-line`), as WCAG asks of a control. */
const inputClassName =
	'h-(--app-control-height) w-full min-w-0 rounded-lg border border-control-line/70 bg-transparent px-2.5 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
	const [showPassword, setShowPassword] = React.useState(false);
	const isPassword = type === 'password';
	const inputType = isPassword && showPassword ? 'text' : type;

	if (isPassword) {
		return (
			<div className='relative w-full'>
				<input
					type={inputType}
					data-slot='input'
					className={cn(inputClassName, 'pr-9', className)}
					{...props}
				/>
				<button
					type='button'
					onClick={() => setShowPassword(!showPassword)}
					className='absolute top-1/2 right-2 flex -translate-y-1/2 cursor-pointer items-center text-muted-foreground transition-colors hover:text-foreground'
					tabIndex={-1}
					aria-label={showPassword ? 'Hide password' : 'Show password'}
				>
					{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
				</button>
			</div>
		);
	}

	return <input type={type} data-slot='input' className={cn(inputClassName, className)} {...props} />;
}

function NakedInput({ className, ...props }: React.ComponentProps<'input'>) {
	return (
		<input
			className={cn(
				'border-none bg-transparent p-0 text-inherit outline-none placeholder:font-normal placeholder:text-muted-foreground',
				className,
			)}
			{...props}
		/>
	);
}

export { Input, NakedInput };
