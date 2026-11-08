import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import styles from './utils.module.css';
import type { ClassValue } from 'clsx';

/** Joins class names; later Tailwind utilities replace conflicting earlier ones (shadcn's `cn`). */
export function cn(...inputs: Array<ClassValue>) {
	return twMerge(clsx(inputs));
}

/** Hide/show an element based on a condition by changing the opacity and visibility */
export function hideIf(condition: boolean): string {
	return condition ? styles.hidden : styles.shown;
}

type VariantConfig<V extends Record<string, Record<string, ClassValue>>> = {
	variants: V;
	defaultVariants?: { [K in keyof V]?: keyof V[K] };
};

/** Maps variant props onto classes. Callers keep a typed table instead of a chain of conditions. */
export function classVariants<V extends Record<string, Record<string, ClassValue>>>(
	base: ClassValue,
	config: VariantConfig<V>,
) {
	return (props: { [K in keyof V]?: keyof V[K] | null } & { className?: ClassValue } = {}) => {
		const selected = Object.keys(config.variants).map((key) => {
			const choice = props[key] ?? config.defaultVariants?.[key];
			return choice === undefined || choice === null ? undefined : config.variants[key][choice as string];
		});
		return cn(base, selected, props.className);
	};
}

export type VariantProps<T extends (...args: never[]) => unknown> = NonNullable<Parameters<T>[0]>;

export function formatBytes(bytes: number): string {
	if (bytes === 0) {
		return '0 B';
	}
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	const value = bytes / Math.pow(k, i);
	return `${value % 1 === 0 ? value : value.toFixed(1)} ${sizes[i]}`;
}

export function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

export function isLast<T>(item: T, array: T[]): boolean {
	return item === array.at(-1);
}

export function areArraysShallowEqual<T>(previous: readonly T[], next: readonly T[]): boolean {
	return previous.length === next.length && previous.every((item, index) => item === next[index]);
}

export function toLocalDateString(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export function toUtcDateString(d: Date): string {
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, '0');
	const day = String(d.getUTCDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}
