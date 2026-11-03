import { createFileRoute } from '@tanstack/react-router';
import type { EncounterTab } from '@/feature/encounters/encounter-tabs';
import { ENCOUNTER_TABS } from '@/feature/encounters/encounter-tabs';
import { EncounterPage } from '@/feature/encounters/encounter-page';

export const Route = createFileRoute('/_protected/patients/$patientId/encounters/$encounterId')({
	validateSearch: (search: Record<string, unknown>): { tab?: EncounterTab } => ({
		tab: ENCOUNTER_TABS.includes(search.tab as EncounterTab) ? (search.tab as EncounterTab) : undefined,
	}),
	component: RouteComponent,
});

function RouteComponent() {
	const { patientId, encounterId } = Route.useParams();
	const { tab } = Route.useSearch();
	return <EncounterPage patientId={patientId} encounterId={encounterId} tab={tab ?? 'note'} />;
}
