import { createFileRoute } from '@tanstack/react-router';
import { SuppliersPage } from '@/feature/pharmacy/suppliers-page';

export const Route = createFileRoute('/_protected/pharmacy/suppliers')({
	component: SuppliersPage,
});
