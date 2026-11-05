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
	CRITICAL_HIGH: { tone: 'critical', icon: OctagonAlert, label: 'Critical high' },
	CRITICAL_LOW: { tone: 'critical', icon: OctagonAlert, label: 'Critical low' },
	HIGH: { tone: 'abnormal', icon: ArrowUp, label: 'High' },
	LOW: { tone: 'abnormal', icon: ArrowDown, label: 'Low' },
	ABNORMAL: { tone: 'abnormal', icon: TriangleAlert, label: 'Abnormal' },
	NORMAL: { tone: 'normal', icon: Check, label: 'Normal' },
};

/** A result's flag as the API sends it (`HIGH`), or a vital sign's (`high`, `@loopwise/shared/vitals`). */
export type FlagLike = ResultFlag | Lowercase<ResultFlag>;

const toResultFlag = (flag: FlagLike) => flag.toUpperCase() as ResultFlag;

/** A lab result's flag: "Critical high", "High", "Normal"… with its icon. */
export function ResultFlagChip({ flag }: { flag: FlagLike }) {
	const { tone, icon, label } = RESULT_FLAGS[toResultFlag(flag)];
	return (
		<ClinicalFlag tone={tone} icon={icon}>
			{label}
		</ClinicalFlag>
	);
}

export const isCriticalFlag = (flag: FlagLike | null | undefined) =>
	!!flag && (toResultFlag(flag) === 'CRITICAL_HIGH' || toResultFlag(flag) === 'CRITICAL_LOW');

const VALUE_FLAGS: Record<
	Exclude<ResultFlag, 'NORMAL'>,
	{ tone: 'critical' | 'abnormal'; icon: LucideIcon; word: string }
> = {
	CRITICAL_HIGH: { tone: 'critical', icon: OctagonAlert, word: 'critical high' },
	CRITICAL_LOW: { tone: 'critical', icon: OctagonAlert, word: 'critical low' },
	HIGH: { tone: 'abnormal', icon: ArrowUp, word: 'high' },
	LOW: { tone: 'abnormal', icon: ArrowDown, word: 'low' },
	ABNORMAL: { tone: 'abnormal', icon: TriangleAlert, word: 'abnormal' },
};

/**
 * A measurement in a dense table, marked when it is out of range: bold, coloured, an arrow (or the critical sign) and
 * the word for screen readers. Normal values stay plain.
 */
export function FlaggedValue({ flag, children }: { flag: FlagLike | null | undefined; children: ReactNode }) {
	if (!flag || toResultFlag(flag) === 'NORMAL') {
		return <>{children}</>;
	}
	const { tone, icon: Icon, word } = VALUE_FLAGS[toResultFlag(flag) as Exclude<ResultFlag, 'NORMAL'>];
	return (
		<span className={cn(styles.flaggedValue, styles[`${tone}Text`])} data-flag={flag} title={word}>
			{children}
			<Icon aria-hidden />
			<span className='sr-only'>{word}</span>
		</span>
	);
}
