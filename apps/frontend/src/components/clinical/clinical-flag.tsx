import { ArrowDown, ArrowUp, Ban, Check, CircleCheck, Clock, OctagonAlert, TriangleAlert } from 'lucide-react';
import styles from './clinical.module.css';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ResultFlag } from '@/graphql/generated/graphql';
import { cn } from '@/lib/utils';

/** The clinical status tones of docs/design-system.md. Normal is neutral: green only means a loop closed. */
export type ClinicalTone = 'critical' | 'abnormal' | 'normal' | 'info' | 'done' | 'void' | 'draft' | 'wise';

const TONE_ICON: Record<ClinicalTone, LucideIcon | null> = {
	critical: OctagonAlert,
	abnormal: TriangleAlert,
	normal: Check,
	info: Clock,
	done: CircleCheck,
	void: Ban,
	draft: null,
	wise: null,
};

/**
 * A status chip that never relies on colour alone: an icon and a word always come with it. The icon is decorative;
 * the word is what a screen reader reads.
 */
export function ClinicalFlag({
	tone,
	icon,
	children,
	className,
	title,
}: {
	tone: ClinicalTone;
	/** Overrides the tone's icon (e.g. an up arrow for "High"); `null` for none. */
	icon?: LucideIcon | null;
	children: ReactNode;
	className?: string;
	title?: string;
}) {
	const Icon = icon === undefined ? TONE_ICON[tone] : icon;
	return (
		<span className={cn(styles.flag, styles[tone], className)} data-tone={tone} title={title}>
			{Icon && <Icon aria-hidden />}
			{children}
		</span>
	);
}

const RESULT_FLAGS: Record<ResultFlag, { tone: ClinicalTone; icon: LucideIcon; label: string }> = {
	critical_high: { tone: 'critical', icon: OctagonAlert, label: 'Critical high' },
	critical_low: { tone: 'critical', icon: OctagonAlert, label: 'Critical low' },
	high: { tone: 'abnormal', icon: ArrowUp, label: 'High' },
	low: { tone: 'abnormal', icon: ArrowDown, label: 'Low' },
	abnormal: { tone: 'abnormal', icon: TriangleAlert, label: 'Abnormal' },
	normal: { tone: 'normal', icon: Check, label: 'Normal' },
};

/** A lab result's flag: "Critical high", "High", "Normal"… with its icon. */
export function ResultFlagChip({ flag }: { flag: ResultFlag }) {
	const { tone, icon, label } = RESULT_FLAGS[flag];
	return (
		<ClinicalFlag tone={tone} icon={icon}>
			{label}
		</ClinicalFlag>
	);
}

export const isCriticalFlag = (flag: ResultFlag | null | undefined) =>
	flag === 'critical_high' || flag === 'critical_low';

const VALUE_FLAGS: Record<
	Exclude<ResultFlag, 'normal'>,
	{ tone: 'critical' | 'abnormal'; icon: LucideIcon; word: string }
> = {
	critical_high: { tone: 'critical', icon: OctagonAlert, word: 'critical high' },
	critical_low: { tone: 'critical', icon: OctagonAlert, word: 'critical low' },
	high: { tone: 'abnormal', icon: ArrowUp, word: 'high' },
	low: { tone: 'abnormal', icon: ArrowDown, word: 'low' },
	abnormal: { tone: 'abnormal', icon: TriangleAlert, word: 'abnormal' },
};

/**
 * A measurement in a dense table, marked when it is out of range: bold, coloured, an arrow (or the critical sign) and
 * the word for screen readers. Normal values stay plain.
 */
export function FlaggedValue({ flag, children }: { flag: ResultFlag | null | undefined; children: ReactNode }) {
	if (!flag || flag === 'normal') {
		return <>{children}</>;
	}
	const { tone, icon: Icon, word } = VALUE_FLAGS[flag];
	return (
		<span className={cn(styles.flaggedValue, styles[`${tone}Text`])} data-flag={flag} title={word}>
			{children}
			<Icon aria-hidden />
			<span className='sr-only'>{word}</span>
		</span>
	);
}
