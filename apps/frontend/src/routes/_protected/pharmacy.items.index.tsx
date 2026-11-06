import { createFileRoute } from '@tanstack/react-router';
import { ItemsPage } from '@/feature/pharmacy/items-page';

export const Route = createFileRoute('/_protected/pharmacy/items/')({
	component: ItemsPage,
});
