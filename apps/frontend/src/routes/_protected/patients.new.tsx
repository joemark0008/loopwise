import { createFileRoute } from '@tanstack/react-router';
import { RegisterPatientPage } from '@/feature/patients/register-patient-page';

export const Route = createFileRoute('/_protected/patients/new')({
	component: RegisterPatientPage,
});
