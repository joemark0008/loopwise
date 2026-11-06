import { createFileRoute } from '@tanstack/react-router';
import { PharmacyDashboard } from '@/feature/pharmacy/pharmacy-dashboard';

export const Route = createFileRoute('/_protected/pharmacy/')({
	component: PharmacyDashboard,
});
