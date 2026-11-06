import { createFileRoute } from '@tanstack/react-router';
import { InvoicePrint } from '@/feature/billing/invoice-print';

export const Route = createFileRoute('/_print/print/invoice/$invoiceId')({
	component: RouteComponent,
});

function RouteComponent() {
	const { invoiceId } = Route.useParams();
	return <InvoicePrint invoiceId={invoiceId} />;
}
