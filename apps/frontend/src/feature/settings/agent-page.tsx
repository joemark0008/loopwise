import { getRouteApi, useNavigate } from '@tanstack/react-router';
import styles from './agent-page.module.css';
import type { LlmProvider } from '@quarry/shared/types';
import type { ProviderToEdit } from '@/feature/settings/components/llm-providers-section';
import type { TabBarItem } from '@/components/ui/tab-bar';
import { DefaultModelsSection } from '@/feature/settings/components/default-models-section';
import { LlmProvidersSection } from '@/feature/settings/components/llm-providers-section';
import { SavedPrompts } from '@/feature/settings/components/saved-prompts';
import { SettingsDisplayMap } from '@/feature/settings/components/display-map';
import { SettingsProjectMemory } from '@/feature/settings/components/project-memory';
import { SettingsTranscribe } from '@/feature/settings/components/settings-transcribe';
import { SettingsWebSearch } from '@/feature/settings/components/web-search';
import { SettingsCard } from '@/components/ui/settings-card';
import { TabBar, TabPanel } from '@/components/ui/tab-bar';
import { usePermissions } from '@/hooks/use-permissions';

const Route = getRouteApi('/_protected/settings/project/agent');

type AgentTab = 'models' | 'tools';

export type AgentSearch = {
	tab: AgentTab;
	provider?: LlmProvider;
	model?: string;
};

const tabs: TabBarItem<AgentTab>[] = [
	{ id: 'models', label: 'Models' },
	{ id: 'tools', label: 'Capabilities' },
];

const tabIdBase = 'project-agent';

export function ProjectAgentPage() {
	const { tab, provider, model } = Route.useSearch();
	const navigate = useNavigate({ from: '/settings/project/agent' });
	const { isAdmin } = usePermissions();
	const providerToEdit = provider ? { provider, modelId: model } : undefined;

	return (
		<>
			<TabBar
				tabs={tabs}
				activeTab={tab}
				onTabChange={(nextTab) => {
					navigate({
						search: { tab: nextTab },
						replace: true,
					});
				}}
				idBase={tabIdBase}
				className={styles.projectAgentPageTabBar}
			/>
			<TabPanel idBase={tabIdBase} tabId={tab} className={styles.projectAgentPageTabPanel}>
				{tab === 'models' && (
					<ModelsSettings
						isAdmin={isAdmin}
						providerToEdit={providerToEdit}
						onProviderToEditOpened={() => navigate({ search: { tab }, replace: true })}
					/>
				)}
				{tab === 'tools' && <ToolsSettings isAdmin={isAdmin} />}
			</TabPanel>
		</>
	);
}

function ModelsSettings({
	isAdmin,
	providerToEdit,
	onProviderToEditOpened,
}: {
	isAdmin: boolean;
	providerToEdit?: ProviderToEdit;
	onProviderToEditOpened: () => void;
}) {
	return (
		<>
			<SettingsCard
				title='LLM Configuration'
				description='Configure the LLM providers for the agent in this project.'
			>
				<LlmProvidersSection
					isAdmin={isAdmin}
					providerToEdit={providerToEdit}
					onProviderToEditOpened={onProviderToEditOpened}
				/>
			</SettingsCard>
			<DefaultModelsSection isAdmin={isAdmin} />
			<SettingsTranscribe isAdmin={isAdmin} />
		</>
	);
}

function ToolsSettings({ isAdmin }: { isAdmin: boolean }) {
	return (
		<>
			<SettingsWebSearch isAdmin={isAdmin} />
			<SavedPrompts isAdmin={isAdmin} />
			{isAdmin && <SettingsProjectMemory />}
			<SettingsDisplayMap isAdmin={isAdmin} />
		</>
	);
}

export function isAgentTab(value: unknown): value is AgentTab {
	return value === 'models' || value === 'tools';
}
