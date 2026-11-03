import { createFileRoute } from '@tanstack/react-router';
import { requireNonViewerNonCloud } from '@/lib/route-guards';
import { StoragePage } from '@/feature/settings/storage-page';

export const Route = createFileRoute('/_protected/settings/storage')({
	beforeLoad: requireNonViewerNonCloud,
	component: StoragePage,
});
