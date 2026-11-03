import { createFileRoute } from '@tanstack/react-router';
import { PrescriptionPrint } from '@/feature/encounters/print/prescription-print';

export const Route = createFileRoute('/_print/print/prescription/$prescriptionId')({
	component: RouteComponent,
});

function RouteComponent() {
	const { prescriptionId } = Route.useParams();
	return <PrescriptionPrint prescriptionId={prescriptionId} />;
}
