import * as React from 'react';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { DayPicker, getDefaultClassNames } from 'react-day-picker';
import styles from './calendar.module.css';
import type { ChevronProps, DayButton, RootProps, WeekNumberProps } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';

function Calendar({
	className,
	classNames,
	showOutsideDays = true,
	captionLayout = 'label',
	buttonVariant = 'ghost',
	formatters,
	components,
	...props
}: React.ComponentProps<typeof DayPicker> & {
	buttonVariant?: React.ComponentProps<typeof Button>['variant'];
}) {
	const defaultClassNames = getDefaultClassNames();

	return (
		<DayPicker
			showOutsideDays={showOutsideDays}
			className={cn(`${styles.calendarDayPicker} group/calendar`, className)}
			captionLayout={captionLayout}
			formatters={{
				formatMonthDropdown: (date) => date.toLocaleString('default', { month: 'short' }),
				...formatters,
			}}
			classNames={{
				root: cn(styles.calendarRoot, defaultClassNames.root),
				months: cn(styles.calendarMonths, defaultClassNames.months),
				month: cn(styles.calendarMonth, defaultClassNames.month),
				nav: cn(styles.calendarNav, defaultClassNames.nav),
				button_previous: cn(
					buttonVariants({ variant: buttonVariant }),
					styles.calendarButtonPrevious,
					defaultClassNames.button_previous,
				),
				button_next: cn(
					buttonVariants({ variant: buttonVariant }),
					styles.calendarButtonPrevious,
					defaultClassNames.button_next,
				),
				month_caption: cn(styles.calendarMonthCaption, defaultClassNames.month_caption),
				dropdowns: cn(styles.calendarDropdowns, defaultClassNames.dropdowns),
				dropdown_root: cn(styles.calendarDropdownRoot, defaultClassNames.dropdown_root),
				dropdown: cn(styles.calendarDropdown, defaultClassNames.dropdown),
				caption_label: cn(
					styles.calendarCaptionLabel,
					captionLayout === 'label' ? styles.calendarCaptionLabel2 : styles.calendarCaptionLabel3,
					defaultClassNames.caption_label,
				),
				month_grid: cn(styles.calendarMonthGrid, defaultClassNames.month_grid),
				weekdays: cn(styles.calendarWeekdays, defaultClassNames.weekdays),
				weekday: cn(styles.calendarWeekday, defaultClassNames.weekday),
				week: cn(styles.calendarWeek, defaultClassNames.week),
				week_number_header: cn(styles.calendarWeekNumberHeader, defaultClassNames.week_number_header),
				week_number: cn(styles.calendarWeekNumber, defaultClassNames.week_number),
				day: cn(`${styles.calendarDay} group/day`, defaultClassNames.day),
				range_start: cn(styles.calendarRangeStart, defaultClassNames.range_start),
				range_middle: cn(styles.calendarRangeMiddle, defaultClassNames.range_middle),
				range_end: cn(styles.calendarRangeEnd, defaultClassNames.range_end),
				today: cn(styles.calendarToday, defaultClassNames.today),
				outside: cn(styles.calendarOutside, defaultClassNames.outside),
				disabled: cn(styles.calendarDisabled, defaultClassNames.disabled),
				hidden: cn(styles.calendarHidden, defaultClassNames.hidden),
				...classNames,
			}}
			components={{
				Root: CalendarRoot,
				Chevron: CalendarChevron,
				DayButton: CalendarDayButton,
				WeekNumber: CalendarWeekNumber,
				...components,
			}}
			{...props}
		/>
	);
}

function CalendarRoot({ className, rootRef, ...props }: RootProps) {
	return <div data-slot='calendar' ref={rootRef} className={cn(className)} {...props} />;
}

function CalendarChevron({ className, orientation, ...props }: ChevronProps) {
	if (orientation === 'left') {
		return <ChevronLeftIcon className={cn(styles.calendarChevronChevronLeftIcon, className)} {...props} />;
	}

	if (orientation === 'right') {
		return <ChevronRightIcon className={cn(styles.calendarChevronChevronLeftIcon, className)} {...props} />;
	}

	return <ChevronDownIcon className={cn(styles.calendarChevronChevronLeftIcon, className)} {...props} />;
}

function CalendarWeekNumber({ children, ...props }: WeekNumberProps) {
	return (
		<td {...props}>
			<div className={styles.calendarWeekNumberDiv}>{children}</div>
		</td>
	);
}

function CalendarDayButton({ className, day, modifiers, ...props }: React.ComponentProps<typeof DayButton>) {
	const defaultClassNames = getDefaultClassNames();

	const ref = React.useRef<HTMLButtonElement>(null);
	React.useEffect(() => {
		if (modifiers.focused) {
			ref.current?.focus();
		}
	}, [modifiers.focused]);

	return (
		<Button
			ref={ref}
			variant='ghost'
			size='icon'
			data-day={day.date.toLocaleDateString()}
			data-selected-single={
				modifiers.selected && !modifiers.range_start && !modifiers.range_end && !modifiers.range_middle
			}
			data-range-start={modifiers.range_start}
			data-range-end={modifiers.range_end}
			data-range-middle={modifiers.range_middle}
			className={cn(styles.calendarDayButtonButton, defaultClassNames.day_button, className)}
			{...props}
		/>
	);
}

export { Calendar, CalendarDayButton };
