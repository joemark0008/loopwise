import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

type LoopwiseLogoAnimatedProps = {
	className?: string;
	style?: CSSProperties;
	width?: number | string;
	height?: number | string;
	durationSeconds?: number;
	loop?: boolean;
	title?: string;
	/** One-colour variant: the ring and the dot become this colour and a tint of it instead of the brand palette. */
	color?: string;
};

/** The Loopwise mark (brand/svg/loopwise-mark.svg): a ring that stops short of closing, and the dot that closes it. */
const RING_PATH = 'M40.87 21.93A17 17 0 1 1 26.07 7.13';
const RING_COLOR = '#3B7BD0';
const DOT_COLOR = '#E8735A';

const SPLINE = '0.33 0 0.67 1';

/** Key times of one cycle: the ring draws, the dot lands, both hold, then the ring unwinds and the dot fades. */
function frames(loop: boolean) {
	return loop
		? {
				ring: { values: '100;0;0;100', keyTimes: '0;0.45;0.8;1' },
				dot: { values: '0;0;1;1;0', keyTimes: '0;0.4;0.55;0.8;1' },
			}
		: {
				ring: { values: '100;0;0', keyTimes: '0;0.45;1' },
				dot: { values: '0;0;1;1', keyTimes: '0;0.4;0.55;1' },
			};
}

function splines(keyTimes: string): string {
	return keyTimes
		.split(';')
		.slice(1)
		.map(() => SPLINE)
		.join(';');
}

function usePrefersReducedMotion(): boolean {
	const [reduced, setReduced] = useState(false);
	useEffect(() => {
		if (typeof window === 'undefined' || !window.matchMedia) {
			return;
		}
		const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
		setReduced(mql.matches);
		const onChange = () => setReduced(mql.matches);
		mql.addEventListener('change', onChange);
		return () => mql.removeEventListener('change', onChange);
	}, []);
	return reduced;
}

/** Loading animation built from the Loopwise mark: the ring draws itself, then the dot closes the loop. */
export default function LoopwiseLogoAnimated({
	className,
	style,
	width = 48,
	height = 48,
	durationSeconds = 2.2,
	loop = true,
	title = 'Loopwise',
	color,
}: LoopwiseLogoAnimatedProps) {
	const reducedMotion = usePrefersReducedMotion();
	const dur = `${durationSeconds}s`;
	const repeatCount = loop ? 'indefinite' : 1;
	const { ring, dot } = frames(loop);

	return (
		<svg
			width={width}
			height={height}
			viewBox='0 0 48 48'
			fill='none'
			xmlns='http://www.w3.org/2000/svg'
			className={className}
			style={style}
			role='img'
			aria-label={title}
		>
			<title>{title}</title>
			<path
				d={RING_PATH}
				stroke={color ?? RING_COLOR}
				strokeWidth={7}
				strokeLinecap='round'
				pathLength={100}
				strokeDasharray={100}
				strokeDashoffset={reducedMotion ? 0 : 100}
			>
				{!reducedMotion && (
					<animate
						attributeName='stroke-dashoffset'
						values={ring.values}
						keyTimes={ring.keyTimes}
						dur={dur}
						calcMode='spline'
						keySplines={splines(ring.keyTimes)}
						repeatCount={repeatCount}
						fill='freeze'
					/>
				)}
			</path>
			<circle
				cx={36.02}
				cy={11.98}
				r={4.5}
				fill={color ? `color-mix(in srgb, ${color}, white 35%)` : DOT_COLOR}
				opacity={reducedMotion ? 1 : 0}
			>
				{!reducedMotion && (
					<animate
						attributeName='opacity'
						values={dot.values}
						keyTimes={dot.keyTimes}
						dur={dur}
						calcMode='spline'
						keySplines={splines(dot.keyTimes)}
						repeatCount={repeatCount}
						fill='freeze'
					/>
				)}
			</circle>
		</svg>
	);
}
