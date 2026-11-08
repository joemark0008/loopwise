import type { ReactNode } from 'react';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** A screen's h1 and its primary actions (one primary per screen), laid out as the kit's dashboard heading. */
export function PageHeader({
	title,
	subtitle,
	actions,
}: {
	title: ReactNode;
	subtitle?: ReactNode;
	actions?: ReactNode;
}) {
	return (
		<header className='flex flex-wrap items-end justify-between gap-x-4 gap-y-3'>
			<div className='min-w-0'>
				<h1 className='font-heading text-xl font-bold tracking-tight text-foreground lg:text-2xl'>{title}</h1>
				{subtitle && <p className='mt-1 text-sm text-muted-foreground'>{subtitle}</p>}
			</div>
			{actions && <div className='flex flex-wrap items-center gap-2'>{actions}</div>}
		</header>
	);
}

/** A titled card on a clinical screen: the kit's card, a header row over an inset content panel. */
export function PageSection({
	title,
	meta,
	children,
	labelledBy,
	className,
}: {
	title: string;
	meta?: ReactNode;
	children: ReactNode;
	labelledBy?: string;
	className?: string;
}) {
	const id = labelledBy ?? `section-${title.toLowerCase().replace(/\W+/g, '-')}`;
	return (
		<Card asChild className={cn('min-w-0', className)} aria-labelledby={id}>
			<section>
				<CardHeader>
					<CardTitle asChild>
						<h2 id={id}>{title}</h2>
					</CardTitle>
					{meta !== undefined && meta !== null && (
						<CardAction className='text-sm text-muted-foreground'>{meta}</CardAction>
					)}
				</CardHeader>
				<CardContent className='flex flex-col gap-3 overflow-x-auto'>{children}</CardContent>
			</section>
		</Card>
	);
}
