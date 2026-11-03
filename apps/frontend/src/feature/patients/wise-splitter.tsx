import { useRef } from 'react';
import styles from './patient-layout.module.css';
import { WISE_MIN_WIDTH } from './use-wise-layout';

const STEP = 24;

/**
 * The handle between the chart and Wise: drag it, or focus it and use the arrow keys (Home and End for the limits).
 * Wise keeps at least 380px and at most half of the space.
 */
export function WiseSplitter({
	width,
	onWidthChange,
	containerRef,
}: {
	width: number;
	onWidthChange: (width: number) => void;
	containerRef: React.RefObject<HTMLElement | null>;
}) {
	const dragging = useRef(false);
	const max = () => Math.max(WISE_MIN_WIDTH, (containerRef.current?.getBoundingClientRect().width ?? 1200) / 2);
	const clamp = (value: number) => Math.min(max(), Math.max(WISE_MIN_WIDTH, value));

	return (
		<div
			className={styles.splitter}
			role='separator'
			aria-orientation='vertical'
			aria-label='Resize Wise'
			aria-valuemin={WISE_MIN_WIDTH}
			aria-valuemax={Math.round(max())}
			aria-valuenow={width}
			tabIndex={0}
			onPointerDown={(event) => {
				dragging.current = true;
				event.currentTarget.setPointerCapture(event.pointerId);
			}}
			onPointerMove={(event) => {
				const box = containerRef.current?.getBoundingClientRect();
				if (dragging.current && box) {
					onWidthChange(clamp(box.right - event.clientX));
				}
			}}
			onPointerUp={(event) => {
				dragging.current = false;
				event.currentTarget.releasePointerCapture(event.pointerId);
			}}
			onKeyDown={(event) => {
				const next =
					event.key === 'ArrowLeft'
						? width + STEP
						: event.key === 'ArrowRight'
							? width - STEP
							: event.key === 'Home'
								? WISE_MIN_WIDTH
								: event.key === 'End'
									? max()
									: null;
				if (next !== null) {
					event.preventDefault();
					onWidthChange(clamp(next));
				}
			}}
		/>
	);
}
