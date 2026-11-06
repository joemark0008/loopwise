import { createFileRoute } from '@tanstack/react-router';
import { DispensePage } from '@/feature/pharmacy/dispense-page';

export const Route = createFileRoute('/_protected/pharmacy/dispense/$prescriptionId')({
	component: function DispenseRoute() {
		const { prescriptionId } = Route.useParams();
		return <DispensePage prescriptionId={prescriptionId} />;
	},
});
