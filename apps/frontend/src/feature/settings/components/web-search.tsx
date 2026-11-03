import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SettingsCard } from '@/components/ui/settings-card';
import { SettingsControlRow } from '@/components/ui/settings-toggle-row';
import { Switch } from '@/components/ui/switch';
import { projectApi } from '@/lib/project-api';

interface SettingsWebSearchProps {
	isAdmin: boolean;
}

export function SettingsWebSearch({ isAdmin }: SettingsWebSearchProps) {
	const queryClient = useQueryClient();
	const agentSettings = useQuery(projectApi.project.getAgentSettings.queryOptions());

	const updateAgentSettings = useMutation(
		projectApi.project.updateAgentSettings.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: projectApi.project.getAgentSettings.queryOptions().queryKey,
				});
			},
		}),
	);

	const webSearchEnabled = agentSettings.data?.webSearch?.enabled ?? false;

	const handleWebSearchChange = (enabled: boolean) => {
		updateAgentSettings.mutate({
			webSearch: { enabled, mode: 'provider' },
		});
	};

	return (
		<SettingsCard
			title='Web search'
			description='Allow the agent to search the web for up-to-date information when answering questions.'
		>
			<SettingsControlRow
				id='web-search'
				label='Enable web search'
				description="Uses the model provider's built-in web search and fetch when available (OpenAI, Anthropic, Google)."
				control={
					<Switch
						id='web-search'
						checked={webSearchEnabled}
						onCheckedChange={handleWebSearchChange}
						disabled={!isAdmin || updateAgentSettings.isPending}
					/>
				}
			/>
		</SettingsCard>
	);
}
