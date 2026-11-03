import { createFileRoute } from '@tanstack/react-router';
import { requireAdvancedSettingsAccess } from '@/lib/route-guards';
import { SettingsLayout } from '@/feature/settings/settings-layout';

export const Route = createFileRoute('/_protected/settings')({
	beforeLoad: ({ location }) => requireAdvancedSettingsAccess(location.pathname),
	component: SettingsLayout,
});
