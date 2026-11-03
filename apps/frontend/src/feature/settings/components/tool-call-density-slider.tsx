import { Slider } from '@mantine/core';
import styles from './tool-call-density-slider.module.css';
import type { ToolCallDensity } from '@quarry/shared/types';
import { cn } from '@/lib/utils';

const densityOptions: { value: ToolCallDensity; label: string }[] = [
	{ value: 'compact', label: 'Compact' },
	{ value: 'detailed', label: 'Detailed' },
];

export const ToolCallDensitySlider = ({
	value,
	onValueChange,
	disabled = false,
}: {
	value: ToolCallDensity;
	onValueChange: (value: ToolCallDensity) => void;
	disabled?: boolean;
}) => {
	const selectedIndex = densityOptions.findIndex((option) => option.value === value);

	return (
		<div className={styles.toolCallDensitySliderDiv}>
			<Slider
				value={selectedIndex}
				onChange={(index) => onValueChange(densityOptions[index].value)}
				min={0}
				max={densityOptions.length - 1}
				step={1}
				disabled={disabled}
				label={null}
				size='sm'
				thumbLabel='Tool call density'
			/>
			<div className={styles.toolCallDensitySliderDiv2}>
				{densityOptions.map((option) => (
					<button
						key={option.value}
						type='button'
						onClick={() => onValueChange(option.value)}
						disabled={disabled}
						className={cn(
							styles.toolCallDensitySliderButton,
							disabled ? styles.toolCallDensitySliderButton2 : styles.toolCallDensitySliderButton3,
							option.value === value
								? styles.toolCallDensitySliderButton4
								: styles.toolCallDensitySliderButton5,
						)}
					>
						{option.label}
					</button>
				))}
			</div>
		</div>
	);
};
