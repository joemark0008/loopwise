import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** An empty list or a screen still to come (the kit's empty state): what goes here, and the next step. */
export function EmptyState({
	icon: Icon,
	title,
	children,
	action,
}: {
	icon?: LucideIcon;
	title: string;
	children?: ReactNode;
	action?: ReactNode;
}) {
	return (
		<div
			className='flex min-w-0 flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center text-balance md:p-8'
			role='status'
		>
			{Icon && (
				<div className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg]:size-5'>
					<Icon aria-hidden />
				</div>
			)}
			<p className='text-base font-medium tracking-tight text-foreground'>{title}</p>
			{children && <p className='max-w-sm text-sm/relaxed text-muted-foreground'>{children}</p>}
			{action}
		</div>
	);
}
