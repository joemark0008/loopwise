import { createFileRoute } from '@tanstack/react-router';
import { Waypoints } from 'lucide-react';
import { PlannedPage } from '@/feature/planned/planned-page';

export const Route = createFileRoute('/_protected/cases')({
	component: () => (
		<PlannedPage
			title='Cases'
			subtitle='Every actionable result followed through to care, with its owner and next step.'
			icon={Waypoints}
			listTitle='My open cases'
			columns={['Patient', 'Pathway', 'State', 'Next step', 'Owner', 'Due']}
			emptyTitle='No open cases yet'
			emptyBody='A case opens when you mark a result actionable. Overdue and escalated cases show first.'
		/>
	),
});
