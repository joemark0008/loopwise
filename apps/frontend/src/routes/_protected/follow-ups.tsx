import { createFileRoute } from '@tanstack/react-router';
import type { FollowUpsSearch } from '@/feature/follow-ups/follow-ups-page';
import { FOLLOW_UP_WINDOWS, FollowUpsPage } from '@/feature/follow-ups/follow-ups-page';

export const Route = createFileRoute('/_protected/follow-ups')({
	validateSearch: (search: Record<string, unknown>): FollowUpsSearch => ({
		doctor: typeof search.doctor === 'string' ? search.doctor : undefined,
		within: FOLLOW_UP_WINDOWS.find((days) => days === Number(search.within)),
	}),
	component: function FollowUpsRoute() {
		return <FollowUpsPage search={Route.useSearch()} />;
	},
});
