import { ArrowRight, CalendarIcon, Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { isSameDay, startOfDay } from 'date-fns';
import styles from './date-range-picker.module.css';
import type { DateRange } from 'react-day-picker';

import type { DateRangeField, DateRangePreset, DateRangeSelection } from '@/lib/date-range';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
	DATE_RANGE_PRESETS,
	countRangeDays,
	findMatchingPreset,
	formatRangeDate,
	formatShortRange,
	getInitialMonth,
	getPreviewRange,
	selectDay,
} from '@/lib/date-range';
import { cn } from '@/lib/utils';

const TODAY_CLASS_NAME = styles.tODAYCLASSNAME;

export function DateRangePicker({
	value,
	onChange,
	placeholder = 'Select a date range',
	className,
}: {
	value: DateRange | undefined;
	onChange: (range: DateRange | undefined) => void;
	placeholder?: string;
	className?: string;
}) {
	const isMobile = useIsMobile();
	const numberOfMonths = isMobile ? 1 : 2;
	const [isOpen, setIsOpen] = useState(false);
	const [selection, setSelection] = useState<DateRangeSelection>(() => initialSelection(value));
	const [month, setMonth] = useState<Date>(() => getInitialMonth(value, numberOfMonths));
	const [hoveredDay, setHoveredDay] = useState<Date | undefined>();

	const handleOpenChange = (open: boolean) => {
		if (open) {
			setSelection(initialSelection(value));
			setMonth(getInitialMonth(value, numberOfMonths));
			setHoveredDay(undefined);
		}
		setIsOpen(open);
	};

	const handlePresetSelect = (preset: DateRangePreset) => {
		const range = preset.getRange(startOfDay(new Date()));
		setSelection({ range, activeField: null, presetId: preset.id });
		setMonth(getInitialMonth(range, numberOfMonths));
	};

	const handleFieldFocus = (field: DateRangeField) => {
		if (field === 'end' && !selection.range?.from) {
			return;
		}
		setSelection((current) => ({ ...current, activeField: field }));
	};

	const handleDayHover = (day: Date) => {
		if (selection.activeField !== 'end') {
			return;
		}
		setHoveredDay((current) => (current && isSameDay(current, day) ? current : day));
	};

	const handleApply = () => {
		onChange(selection.range);
		setIsOpen(false);
	};

	const draftRange = selection.range;
	const isDraftComplete = Boolean(draftRange?.from && draftRange.to);
	const previewRange = getPreviewRange(selection, hoveredDay);

	return (
		<Popover open={isOpen} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<Button variant='outline' size='sm' className={cn(styles.dateRangePickerButton, className)}>
					<CalendarIcon className={styles.dateRangePickerCalendarIcon} />
					<DateRangeTriggerLabel value={value} placeholder={placeholder} />
					<ChevronDown className={styles.dateRangePickerChevronDown} />
				</Button>
			</PopoverTrigger>
			<PopoverContent className={styles.dateRangePickerPopoverContent} align='start'>
				<div className={styles.dateRangePickerDiv}>
					<DateRangePresetList selection={selection} onSelect={handlePresetSelect} />
					<div className={styles.dateRangePickerDiv2}>
						<DateRangeFields
							range={draftRange}
							activeField={selection.activeField}
							onFieldFocus={handleFieldFocus}
						/>
						<Calendar
							mode='range'
							selected={draftRange}
							onSelect={(_range, day) => setSelection((current) => selectDay(current, day))}
							onDayMouseEnter={handleDayHover}
							onDayMouseLeave={() => setHoveredDay(undefined)}
							month={month}
							onMonthChange={setMonth}
							numberOfMonths={numberOfMonths}
							showOutsideDays={false}
							classNames={{ today: TODAY_CLASS_NAME }}
							modifiers={{ preview: previewRange ?? [] }}
							modifiersClassNames={{ preview: styles.dateRangePickerPreview }}
						/>
					</div>
				</div>
				<div className={styles.dateRangePickerDiv3}>
					<DateRangeHint selection={selection} />
					<div className={styles.dateRangePickerDiv4}>
						<Button
							variant='ghost'
							size='sm'
							className={styles.dateRangePickerButton2}
							onClick={() => setIsOpen(false)}
						>
							Cancel
						</Button>
						<Button
							size='sm'
							className={styles.dateRangePickerButton3}
							disabled={!isDraftComplete}
							onClick={handleApply}
						>
							Apply
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}

function DateRangeTriggerLabel({ value, placeholder }: { value: DateRange | undefined; placeholder: string }) {
	if (!value?.from || !value.to) {
		return <span className={styles.dateRangeTriggerLabelSpan}>{placeholder}</span>;
	}

	const preset = findMatchingPreset(value);
	if (!preset) {
		return <span>{formatShortRange(value)}</span>;
	}

	return (
		<span className={styles.dateRangeTriggerLabelSpan2}>
			<span className={styles.dateRangeTriggerLabelSpan3}>{preset.label}</span>
			<span className={styles.dateRangeTriggerLabelSpan}>{formatShortRange(value)}</span>
		</span>
	);
}

function DateRangePresetList({
	selection,
	onSelect,
}: {
	selection: DateRangeSelection;
	onSelect: (preset: DateRangePreset) => void;
}) {
	const selectedPresetId = selection.presetId ?? findMatchingPreset(selection.range)?.id;

	return (
		<div className={styles.dateRangePresetListDiv}>
			<span className={styles.dateRangePresetListSpan}>Quick select</span>
			{DATE_RANGE_PRESETS.map((preset) => {
				const isSelected = selectedPresetId === preset.id;
				return (
					<button
						key={preset.id}
						type='button'
						onClick={() => onSelect(preset)}
						className={cn(
							styles.dateRangePresetListButton,
							isSelected && styles.dateRangePresetListButton2,
						)}
					>
						{preset.label}
						{isSelected && <Check className={styles.dateRangePresetListCheck} />}
					</button>
				);
			})}
		</div>
	);
}

function DateRangeFields({
	range,
	activeField,
	onFieldFocus,
}: {
	range: DateRange | undefined;
	activeField: DateRangeField | null;
	onFieldFocus: (field: DateRangeField) => void;
}) {
	return (
		<div className={styles.dateRangeFieldsDiv}>
			<DateRangeFieldButton
				label='Start date'
				date={range?.from}
				isActive={activeField === 'start'}
				onClick={() => onFieldFocus('start')}
			/>
			<ArrowRight className={styles.dateRangeFieldsArrowRight} />
			<DateRangeFieldButton
				label='End date'
				date={range?.to}
				isActive={activeField === 'end'}
				isDisabled={!range?.from}
				onClick={() => onFieldFocus('end')}
			/>
		</div>
	);
}

function DateRangeFieldButton({
	label,
	date,
	isActive,
	isDisabled = false,
	onClick,
}: {
	label: string;
	date: Date | undefined;
	isActive: boolean;
	isDisabled?: boolean;
	onClick: () => void;
}) {
	const dateLabel = date ? formatRangeDate(date) : 'Select date';

	return (
		<div className={styles.dateRangeFieldButtonDiv}>
			<span className={styles.dateRangeFieldButtonSpan}>{label}</span>
			<button
				type='button'
				disabled={isDisabled}
				onClick={onClick}
				aria-label={`${label}: ${dateLabel}`}
				aria-pressed={isActive}
				className={cn(
					styles.dateRangeFieldButtonButton,
					isActive && styles.dateRangeFieldButtonButton2,
					!date && styles.dateRangeTriggerLabelSpan,
				)}
			>
				{dateLabel}
			</button>
		</div>
	);
}

function DateRangeHint({ selection }: { selection: DateRangeSelection }) {
	const { range, activeField } = selection;
	const dayCount = countRangeDays(range);

	if (activeField === 'start') {
		return <DateRangeStep step={1} message='Click a day to set the start date' />;
	}
	if (activeField === 'end') {
		return <DateRangeStep step={2} message='Now click a day to set the end date' />;
	}
	return (
		<span className={styles.dateRangeHintSpan}>
			<span className={styles.dateRangeHintSpan2}>
				{dayCount} {dayCount === 1 ? 'day' : 'days'}
			</span>{' '}
			selected · click a day to start over
		</span>
	);
}

function DateRangeStep({ step, message }: { step: 1 | 2; message: string }) {
	return (
		<span className={styles.dateRangeStepSpan}>
			<span className={styles.dateRangeStepSpan2}>{step}</span>
			{message}
		</span>
	);
}

function initialSelection(value: DateRange | undefined): DateRangeSelection {
	const isComplete = Boolean(value?.from && value.to);
	if (isComplete) {
		return { range: value, activeField: null };
	}
	return { range: value, activeField: value?.from ? 'end' : 'start' };
}
