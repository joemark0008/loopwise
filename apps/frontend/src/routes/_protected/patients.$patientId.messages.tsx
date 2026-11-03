import { createFileRoute } from '@tanstack/react-router';
import { MessageCircle } from 'lucide-react';
import { PatientPlannedSection } from '@/feature/planned/patient-planned-section';

export const Route = createFileRoute('/_protected/patients/$patientId/messages')({
	component: () => (
		<PatientPlannedSection
			title='Messages to the patient'
			icon={MessageCircle}
			emptyTitle='No messages yet'
			emptyBody='SMS invites and the patient’s replies appear here. Messages never contain results or diagnoses.'
		/>
	),
});
