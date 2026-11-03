import { createFileRoute } from '@tanstack/react-router';
import { PatientResultsSection } from '@/feature/results/patient-results-section';

export const Route = createFileRoute('/_protected/patients/$patientId/results')({
	component: PatientResultsRoute,
});

function PatientResultsRoute() {
	const { patientId } = Route.useParams();
	return <PatientResultsSection patientId={patientId} />;
}
