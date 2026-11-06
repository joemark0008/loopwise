import { createFileRoute } from '@tanstack/react-router';
import { ReceivePage } from '@/feature/pharmacy/receive-page';

export const Route = createFileRoute('/_protected/pharmacy/receive')({
	component: ReceivePage,
});
