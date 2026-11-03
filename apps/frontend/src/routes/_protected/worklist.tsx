import { createFileRoute } from '@tanstack/react-router';
import { ListChecks } from 'lucide-react';
import { PlannedPage } from '@/feature/planned/planned-page';

export const Route = createFileRoute('/_protected/worklist')({
	component: () => (
		<PlannedPage
			title='Worklist'
			subtitle='Calls, referrals to assign and overdue follow-ups for the care team.'
			icon={ListChecks}
			listTitle='Due today'
			columns={['Patient', 'Task', 'Case', 'Due', 'Attempts', 'Assigned to']}
			emptyTitle='Nothing due'
			emptyBody='Nurse tasks from the case engine (calls, unreachable patients, home visits) appear here.'
		/>
	),
});
