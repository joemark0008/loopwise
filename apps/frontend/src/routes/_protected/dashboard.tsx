import { createFileRoute } from '@tanstack/react-router';
import { ChartColumn } from 'lucide-react';
import { PlannedPage } from '@/feature/planned/planned-page';

export const Route = createFileRoute('/_protected/dashboard')({
	component: () => (
		<PlannedPage
			title='Program dashboard'
			subtitle='Loop closure across facilities: time to care, drop-offs and equity.'
			icon={ChartColumn}
			listTitle='Loop-closure metrics'
			columns={['Metric', 'This month', 'Baseline', 'Change']}
			emptyTitle='No metrics yet'
			emptyBody='Metrics are computed from closed and open cases once the case engine runs.'
		/>
	),
});
