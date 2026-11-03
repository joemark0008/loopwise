import { createFileRoute } from '@tanstack/react-router';
import { PatientLayout } from '@/feature/patients/patient-layout';

export const Route = createFileRoute('/_protected/patients/$patientId')({
	component: RouteComponent,
});

function RouteComponent() {
	const { patientId } = Route.useParams();
	return <PatientLayout patientId={patientId} />;
}
