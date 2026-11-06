import { createFileRoute } from '@tanstack/react-router';
import type { ReferralsSearch } from '@/feature/follow-ups/referrals-page';
import { ReferralsPage } from '@/feature/follow-ups/referrals-page';

export const Route = createFileRoute('/_protected/referrals')({
	validateSearch: (search: Record<string, unknown>): ReferralsSearch => ({
		box: search.box === 'outbox' || search.box === 'clinic' ? search.box : undefined,
	}),
	component: function ReferralsRoute() {
		return <ReferralsPage search={Route.useSearch()} />;
	},
});
