import { createFileRoute } from '@tanstack/react-router';
import { GeneralPage } from '@/feature/settings/account-page';

export const Route = createFileRoute('/_protected/settings/account')({
	component: GeneralPage,
});
