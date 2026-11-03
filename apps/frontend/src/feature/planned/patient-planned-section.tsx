import type { LucideIcon } from 'lucide-react';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageSection } from '@/components/clinical/page-header';

/** A patient page whose feature is not built yet: its section and an empty state naming what fills it. */
export function PatientPlannedSection({
	title,
	icon,
	emptyTitle,
	emptyBody,
}: {
	title: string;
	icon: LucideIcon;
	emptyTitle: string;
	emptyBody: string;
}) {
	return (
		<PageSection title={title}>
			<EmptyState icon={icon} title={emptyTitle}>
				{emptyBody}
			</EmptyState>
		</PageSection>
	);
}
