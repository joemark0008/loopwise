import { Children, isValidElement } from 'react';
import type { FloatingPosition } from '@mantine/core';
import type { ElementType, ReactNode } from 'react';

export type FloatingSide = 'top' | 'right' | 'bottom' | 'left';
export type FloatingAlign = 'start' | 'center' | 'end';

export function toFloatingPosition(side: FloatingSide = 'bottom', align: FloatingAlign = 'center'): FloatingPosition {
	return (align === 'center' ? side : `${side}-${align}`) as FloatingPosition;
}

/** Mantine positions from the root, while callers set position on the content part, so the root looks it up. */
export function findPart<Props>(children: ReactNode, part: ElementType): Props | undefined {
	for (const child of Children.toArray(children)) {
		if (!isValidElement(child)) {
			continue;
		}
		if (child.type === part) {
			return child.props as Props;
		}
		const nested = findPart<Props>((child.props as { children?: ReactNode }).children, part);
		if (nested) {
			return nested;
		}
	}
	return undefined;
}
