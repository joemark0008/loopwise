import { createFileRoute } from '@tanstack/react-router';
import { PatientListPage } from '@/feature/patients/patient-list-page';

export const Route = createFileRoute('/_protected/patients/')({
	component: PatientListPage,
});
