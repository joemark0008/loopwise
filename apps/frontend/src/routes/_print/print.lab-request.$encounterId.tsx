import { createFileRoute } from '@tanstack/react-router';
import { LabRequestPrint } from '@/feature/encounters/print/lab-request-print';

export const Route = createFileRoute('/_print/print/lab-request/$encounterId')({
	component: RouteComponent,
});

function RouteComponent() {
	const { encounterId } = Route.useParams();
	return <LabRequestPrint encounterId={encounterId} />;
}
