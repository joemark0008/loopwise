import { createFileRoute } from '@tanstack/react-router';
import { ConsumptionPage } from '@/feature/pharmacy/consumption-page';

export const Route = createFileRoute('/_protected/pharmacy/consumption')({
	component: ConsumptionPage,
});
