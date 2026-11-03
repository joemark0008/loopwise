import { createFileRoute } from '@tanstack/react-router';
import { validateUsageSearchWithStoredFilters } from '@/feature/settings/components/usage-route-search';
import { requireNonViewer } from '@/lib/route-guards';
import { UsagePage } from '@/feature/settings/usage-page';

export const Route = createFileRoute('/_protected/settings/usage')({
	beforeLoad: requireNonViewer,
	validateSearch: validateUsageSearchWithStoredFilters,
	component: UsagePage,
});
