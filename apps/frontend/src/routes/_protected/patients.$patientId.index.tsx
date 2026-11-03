import { createFileRoute } from '@tanstack/react-router';
import { PatientChartPage } from '@/feature/patients/patient-chart-page';

export const Route = createFileRoute('/_protected/patients/$patientId/')({
	component: RouteComponent,
});

function RouteComponent() {
	const { patientId } = Route.useParams();
	return <PatientChartPage patientId={patientId} />;
}
