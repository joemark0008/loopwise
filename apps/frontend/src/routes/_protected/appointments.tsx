import { createFileRoute } from '@tanstack/react-router';
import type { AppointmentsSearch } from '@/feature/scheduling/appointments-page';
import { AppointmentsPage } from '@/feature/scheduling/appointments-page';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const Route = createFileRoute('/_protected/appointments')({
	validateSearch: (search: Record<string, unknown>): AppointmentsSearch => ({
		date: typeof search.date === 'string' && DATE.test(search.date) ? search.date : undefined,
		view: search.view === 'week' ? 'week' : search.view === 'day' ? 'day' : undefined,
		doctor: typeof search.doctor === 'string' ? search.doctor : undefined,
	}),
	component: function AppointmentsRoute() {
		return <AppointmentsPage search={Route.useSearch()} />;
	},
});
