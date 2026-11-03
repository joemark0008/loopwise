import { createFileRoute } from '@tanstack/react-router';
import { WiseToolsPage } from '@/feature/settings/wise-tools-page';

export const Route = createFileRoute('/_protected/settings/wise-tools')({
	component: WiseToolsPage,
});
