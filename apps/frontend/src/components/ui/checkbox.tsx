import { Checkbox as MantineCheckbox } from '@mantine/core';
import type { ComponentProps } from 'react';

function Checkbox({
	className,
	checked,
	onCheckedChange,
	...props
}: Omit<ComponentProps<'input'>, 'size' | 'onChange'> & {
	checked?: boolean;
	onCheckedChange?: (checked: boolean) => void;
}) {
	return (
		<MantineCheckbox
			data-slot='checkbox'
			size='xs'
			className={className}
			checked={checked}
			onChange={(event) => onCheckedChange?.(event.currentTarget.checked)}
			{...(props as object)}
		/>
	);
}

export { Checkbox };
