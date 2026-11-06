import { createFileRoute } from '@tanstack/react-router';
import { PharmacyLayout } from '@/feature/pharmacy/pharmacy-layout';

export const Route = createFileRoute('/_protected/pharmacy')({
	component: PharmacyLayout,
});
