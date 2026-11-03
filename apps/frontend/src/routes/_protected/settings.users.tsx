import { createFileRoute } from '@tanstack/react-router';
import { requireOrgAdmin } from '@/lib/route-guards';
import { UsersPage } from '@/feature/settings/users-page';

export const Route = createFileRoute('/_protected/settings/users')({
	beforeLoad: requireOrgAdmin,
	component: UsersPage,
});
