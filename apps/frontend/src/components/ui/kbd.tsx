import type { HTMLAttributes } from 'react';
import type { Shortcut } from '@/lib/platform';

import { formatShortcut } from '@/lib/platform';
import { cn } from '@/lib/utils';

type KbdProps = HTMLAttributes<HTMLSpanElement> & {
	shortcut?: Shortcut;
	keys?: string[];
};

export function Kbd({ shortcut, keys, className, ...props }: KbdProps) {
	const tokens = keys ?? (shortcut ? formatShortcut(shortcut) : []);

	return (
		<span data-slot='kbd-group' className={cn('inline-flex items-center gap-0.5', className)} {...props}>
			{tokens.map((token, index) => (
				<kbd
					key={`${token}-${index}`}
					data-slot='kbd'
					className="pointer-events-none inline-flex h-5 min-w-5 items-center justify-center gap-1 rounded-sm bg-muted px-1 font-sans text-xs font-medium text-muted-foreground select-none [&_svg:not([class*='size-'])]:size-3"
				>
					{token}
				</kbd>
			))}
		</span>
	);
}
