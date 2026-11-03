import { createFileRoute } from '@tanstack/react-router';
import { MedicalCertificatePrint } from '@/feature/encounters/print/medical-certificate-print';

export const Route = createFileRoute('/_print/print/medical-certificate/$certificateId')({
	component: RouteComponent,
});

function RouteComponent() {
	const { certificateId } = Route.useParams();
	return <MedicalCertificatePrint certificateId={certificateId} />;
}
