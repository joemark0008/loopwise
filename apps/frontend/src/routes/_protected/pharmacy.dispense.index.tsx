import { createFileRoute } from '@tanstack/react-router';
import { DispenseQueuePage } from '@/feature/pharmacy/dispense-queue-page';

export const Route = createFileRoute('/_protected/pharmacy/dispense/')({
	component: DispenseQueuePage,
});
