import { Children, cloneElement, isValidElement } from 'react';
import type { HTMLAttributes, ReactElement, ReactNode, Ref } from 'react';

import { cn } from '@/lib/utils';

type AnyProps = Record<string, unknown>;

/** Merges this element's props onto its only child, so a component can render as a link or another control. */
export function Slot({
	children,
	ref,
	...slotProps
}: HTMLAttributes<HTMLElement> & { children?: ReactNode; ref?: Ref<HTMLElement> } & AnyProps) {
	const child = Children.only(children);
	if (!isValidElement(child)) {
		return null;
	}
	const element = child as ReactElement<AnyProps>;
	return cloneElement(element, {
		...mergeSlotProps(slotProps, element.props),
		ref: ref ?? element.props.ref,
	} as AnyProps);
}

export function mergeSlotProps(slotProps: AnyProps, childProps: AnyProps): AnyProps {
	const merged: AnyProps = { ...slotProps, ...childProps };
	for (const key of Object.keys(slotProps)) {
		const slotValue = slotProps[key];
		const childValue = childProps[key];
		if (/^on[A-Z]/.test(key) && typeof slotValue === 'function' && typeof childValue === 'function') {
			merged[key] = (...args: unknown[]) => {
				(childValue as (...a: unknown[]) => void)(...args);
				(slotValue as (...a: unknown[]) => void)(...args);
			};
		} else if (key === 'className') {
			merged.className = cn(slotValue as string, childValue as string);
		} else if (key === 'style') {
			merged.style = { ...(slotValue as object), ...(childValue as object) };
		}
	}
	return merged;
}
