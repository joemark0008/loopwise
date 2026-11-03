import { createFileRoute } from '@tanstack/react-router';
import { isLlmProvider } from '@quarry/shared/types';
import type { AgentSearch } from '@/feature/settings/agent-page';
import { ProjectAgentPage, isAgentTab } from '@/feature/settings/agent-page';

export const Route = createFileRoute('/_protected/settings/project/agent')({
	staticData: {
		title: 'Agent',
	},
	validateSearch: (search: Record<string, unknown>): AgentSearch => ({
		tab: search.tab === 'memory' ? 'tools' : isAgentTab(search.tab) ? search.tab : 'models',
		provider: typeof search.provider === 'string' && isLlmProvider(search.provider) ? search.provider : undefined,
		model: typeof search.model === 'string' ? search.model : undefined,
	}),
	component: ProjectAgentPage,
});
