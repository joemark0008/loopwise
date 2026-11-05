import { Activity, Dot, Globe, Lock, ShieldCheck, Users } from 'lucide-react';
import styles from './item-card.module.css';
import type { ReactNode } from 'react';
import type { StoryPanelDisplayMode, Visibility } from '@loopwise/shared/types';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { formatRelativeDate } from '@/lib/time-ago';
import { cn } from '@/lib/utils';

export const GRID_CARD_CLASS = `${styles.gRIDCARDCLASS} group`;

export const LINES_CARD_CLASS = `${styles.lINESCARDCLASS} group`;

export const GRID_THUMBNAIL_CLASS = styles.gRIDTHUMBNAILCLASS;

export const GRID_HOVER_ACTION_GRADIENT_CLASS = styles.gRIDHOVERACTIONGRADIENTCLASS;

export function CardsSection({
	title,
	className,
	action,
	children,
}: {
	title: string;
	className?: string;
	action?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className={className}>
			<div className={styles.cardsSectionDiv}>
				<h2 className={styles.cardsSectionH2}>{title}</h2>
				{action}
			</div>
			{children}
		</section>
	);
}

export function CardsGrid({ displayMode, children }: { displayMode: StoryPanelDisplayMode; children: ReactNode }) {
	return (
		<div
			className={cn(
				displayMode === styles.cardsGridDiv && `${styles.cardsGridDiv2} 2xl:grid-cols-6`,
				displayMode === 'lines' && styles.cardsGridDiv3,
			)}
		>
			{children}
		</div>
	);
}

export function GridCardFooter({ title, subtitle }: { title: string; subtitle: ReactNode }) {
	return (
		<div className={styles.gridCardFooterDiv}>
			<span className={styles.gridCardFooterSpan}>{title}</span>
			<span className={styles.gridCardFooterSpan2}>{subtitle}</span>
		</div>
	);
}

export function AuthorDateLabel({ author, createdAt }: { author: string; createdAt: Date }) {
	return (
		<>
			{author}
			<Dot className={styles.authorDateLabelDot} />
			{formatRelativeDate(createdAt)}
		</>
	);
}

export function NoResults({ query }: { query: string }) {
	return <p className={styles.noResultsP}>No results matching &ldquo;{query.trim()}&rdquo;</p>;
}

export function LiveBadge({ iconOnly = false }: { iconOnly?: boolean }) {
	return (
		<SimpleTooltip content='Live story'>
			<span className={styles.liveBadgeSpan}>
				<Activity className={styles.liveBadgeActivity} />
				<span className={iconOnly ? 'sr-only' : styles.liveBadgeSpan2}>Live</span>
			</span>
		</SimpleTooltip>
	);
}

export function CertifiedBadge({ certifiedByName }: { certifiedByName?: string | null }) {
	return (
		<SimpleTooltip content={certifiedByName ? `Certified by ${certifiedByName}` : 'Certified by an admin'}>
			<span className={styles.certifiedBadgeSpan}>
				<ShieldCheck className={styles.liveBadgeActivity} />
				<span className={styles.liveBadgeSpan2}>Certified</span>
			</span>
		</SimpleTooltip>
	);
}

export function PrivateBadge({ label = 'Private story' }: { label?: string }) {
	return (
		<SimpleTooltip content={label}>
			<span className={styles.privateBadgeSpan}>
				<Lock className={styles.liveBadgeActivity} />
			</span>
		</SimpleTooltip>
	);
}

export function SharingBadge({
	visibility,
	sharedWithCount,
	sharedWithGroupCount,
}: {
	visibility: Visibility;
	sharedWithCount?: number;
	sharedWithGroupCount?: number;
}) {
	const tooltip =
		visibility === 'clinic'
			? 'Shared with the clinic'
			: sharedWithCount != null
				? `Shared with ${formatSharedWith(sharedWithCount, sharedWithGroupCount ?? 0)}`
				: 'Shared with specific people';

	return (
		<SimpleTooltip content={tooltip}>
			<span className={styles.sharingBadgeSpan}>
				{visibility === 'clinic' ? (
					<Globe className={styles.liveBadgeActivity} />
				) : (
					<Users className={styles.liveBadgeActivity} />
				)}
			</span>
		</SimpleTooltip>
	);
}

function formatSharedWith(userCount: number, groupCount: number): string {
	const users = `${userCount} user${userCount !== 1 ? 's' : ''}`;
	if (groupCount === 0) {
		return users;
	}
	const groups = `${groupCount} group${groupCount !== 1 ? 's' : ''}`;
	return userCount === 0 ? groups : `${users} and ${groups}`;
}
