import { createFileRoute } from '@tanstack/react-router';
import { Waypoints } from 'lucide-react';
import { PatientPlannedSection } from '@/feature/planned/patient-planned-section';

export const Route = createFileRoute('/_protected/patients/$patientId/cases')({
	component: () => (
		<PatientPlannedSection
			title='Cases'
			icon={Waypoints}
			emptyTitle='No cases yet'
			emptyBody='Each actionable result becomes a case with a timeline: notified, referred, seen, treated, closed.'
		/>
	),
});
